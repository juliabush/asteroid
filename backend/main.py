import os
import pygame
import asyncio
import json

from backend.constants import SCREEN_WIDTH, SCREEN_HEIGHT, PLAYER_SPEED, PLAYER_TURN_SPEED
from backend.logger import log_event
from backend.player import Player
from backend.asteroidfield import AsteroidField
from backend.asteroid import Asteroid
from backend.shot import Shot

os.environ["SDL_VIDEODRIVER"] = "dummy"

pygame.init()
screen = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT))

# ─────────────────────────────
# Game phase
# ─────────────────────────────

PHASE_RUNNING = "running"
PHASE_GAME_OVER = "game_over"

game_phase = PHASE_RUNNING

# ─────────────────────────────
# Sprite groups
# ─────────────────────────────

updatable = pygame.sprite.Group()
drawable = pygame.sprite.Group()
asteroids = pygame.sprite.Group()
shots = pygame.sprite.Group()

def bind_containers():
    Player.containers = (updatable, drawable)
    Asteroid.containers = (asteroids, updatable, drawable)
    Shot.containers = (shots, updatable, drawable)
    AsteroidField.containers = (updatable,)

bind_containers()

player_object = None
asteroidfield_object = None

# ─────────────────────────────
# Game lifecycle
# ─────────────────────────────

def reset_game(player_inputs=None):
    global player_object, asteroidfield_object, game_phase

    updatable.empty()
    drawable.empty()
    asteroids.empty()
    shots.empty()

    bind_containers()

    if player_inputs is not None:
        for k in player_inputs:
            player_inputs[k] = False

    player_object = Player(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2)
    asteroidfield_object = AsteroidField()

    game_phase = PHASE_RUNNING


# ─────────────────────────────
# Simulation
# ─────────────────────────────

def run_game_step(dt):
    updatable.update(dt)

    for asteroid in list(asteroids):
        for shot in list(shots):
            if asteroid.collides_with(shot):
                log_event("asteroid_shot")
                shot.kill()
                asteroid.split()

        if asteroid.collides_with(player_object):
            log_event("player_hit")
            return "player_hit"

    return "ok"

# ─────────────────────────────
# Main loop
# ─────────────────────────────

async def game_loop(connected_clients, player_inputs):
    global game_phase

    reset_game(player_inputs)

    dt = 1 / 60

    while True:
        if game_phase == PHASE_RUNNING:
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

            if status == "player_hit":
                game_phase = PHASE_GAME_OVER
                if connected_clients:
                    msg = json.dumps({"type": "game_over"})
                    await asyncio.gather(
                        *(c.send(msg) for c in connected_clients),
                        return_exceptions=True
                    )

        if connected_clients:
            state = {
                "player": [player_object.position.x, player_object.position.y],
                "asteroids": [[a.position.x, a.position.y, a.radius] for a in asteroids],
                "shots": [[s.position.x, s.position.y] for s in shots],
            }

            msg = json.dumps({
                "type": "state",
                "phase": game_phase,
                "data": state
            })

            await asyncio.gather(
                *(c.send(msg) for c in connected_clients),
                return_exceptions=True
            )

        await asyncio.sleep(dt)
