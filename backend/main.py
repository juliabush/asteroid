import os
import pygame
import asyncio
import json

from backend.constants import SCREEN_WIDTH, SCREEN_HEIGHT, PLAYER_SPEED, PLAYER_TURN_SPEED
from backend.logger import log_state, log_event
from backend.player import Player
from backend.asteroidfield import AsteroidField
from backend.asteroid import Asteroid
from backend.shot import Shot

os.environ["SDL_VIDEODRIVER"] = "dummy"

pygame.init()
screen = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT))
clock = pygame.time.Clock()

updatable = pygame.sprite.Group()
drawable = pygame.sprite.Group()
asteroids = pygame.sprite.Group()
shots = pygame.sprite.Group()

Player.containers = (updatable, drawable)
Asteroid.containers = (asteroids, updatable, drawable)
Shot.containers = (shots, updatable, drawable)
AsteroidField.containers = (updatable,)

player_object = Player(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2)
asteroidfield_object = AsteroidField()


def reset_game():
    """Reset all game objects to their initial state."""
    updatable.empty()
    drawable.empty()
    asteroids.empty()
    shots.empty()

    Player.containers = (updatable, drawable)
    Asteroid.containers = (asteroids, updatable, drawable)
    Shot.containers = (shots, updatable, drawable)
    AsteroidField.containers = (updatable,)

    global player_object, asteroidfield_object
    player_object = Player(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2)
    asteroidfield_object = AsteroidField()

    print("Game reset — ready to play again!")


def run_game_step(dt):
    """Updates all objects and checks for collisions."""
    updatable.update(dt)

    for asteroid in asteroids:
        for shot in shots:
            if asteroid.collides_with(shot):
                log_event("asteroid_shot")
                shot.kill()
                asteroid.split()

        if asteroid.collides_with(player_object):
            log_event("player_hit")
            print("Game Over!")
            return "game_over"

    return "ok"


async def game_loop(connected_clients, player_inputs):
    """Main async game loop that sends state updates to all clients."""
    dt = 1 / 60

    while True:
        clock.tick(60)

        if player_inputs["left"]:
            player_object.rotation -= PLAYER_TURN_SPEED * dt
        if player_inputs["right"]:
            player_object.rotation += PLAYER_TURN_SPEED * dt
        if player_inputs["up"]:
            forward = pygame.Vector2(0, 1).rotate(player_object.rotation)
            player_object.position += forward * PLAYER_SPEED * dt
        if player_inputs["down"]:
            backward = pygame.Vector2(0, -1).rotate(player_object.rotation)
            player_object.position += backward * PLAYER_SPEED * dt
        if player_inputs["space"]:
            player_object.shoot()

        status = run_game_step(dt)

        if status == "game_over":
            if connected_clients:
                msg = json.dumps({"type": "game_over"})
                await asyncio.gather(*(c.send(msg) for c in connected_clients))

            print("Waiting for restart...")
            while not player_inputs.get("restart", False):
                await asyncio.sleep(0.1)
            player_inputs["restart"] = False
            reset_game()
            continue

        state = {
            "player": [player_object.position.x, player_object.position.y],
            "asteroids": [
                [a.position.x, a.position.y, a.radius] for a in asteroids
            ],
            "shots": [
                [s.position.x, s.position.y] for s in shots
            ],
        }

        if connected_clients:
            msg = json.dumps({"type": "state", "data": state})
            await asyncio.gather(*(c.send(msg) for c in connected_clients))

        await asyncio.sleep(dt)
