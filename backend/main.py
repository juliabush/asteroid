import os
import pygame
import asyncio
import json

from constants import (
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    PLAYER_SPEED,
    PLAYER_TURN_SPEED,
)
from player import Player
from asteroidfield import AsteroidField
from asteroid import Asteroid
from shot import Shot

os.environ["SDL_VIDEODRIVER"] = "dummy"
pygame.init()
screen = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT))

PHASE_RUNNING = "running"
PHASE_GAME_OVER = "game_over"

game_phase = PHASE_RUNNING

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

def wrap_position(pos):
    pos.x %= SCREEN_WIDTH
    pos.y %= SCREEN_HEIGHT


def reset_game():
    global game_phase

    updatable.empty()
    drawable.empty()
    asteroids.empty()
    shots.empty()

    bind_containers()

    AsteroidField()
    game_phase = PHASE_RUNNING


def run_game_step(dt, players):
    updatable.update(dt)

    for asteroid in list(asteroids):
        for player in players.values():
            if asteroid.collides_with(player):
                return "player_hit"

    for asteroid in list(asteroids):
        for shot in list(shots):
            if asteroid.collides_with(shot):
                shot.kill()
                asteroid.split()

    return "Everything works as intended"


async def game_loop(connected_clients, players, player_inputs):
    global game_phase

    dt = 1 / 60

    while True:
        if game_phase == PHASE_RUNNING:
            for ws, player in players.items():
                inputs = player_inputs.get(ws)
                if not inputs:
                    continue

                player.shot_cooldown = max(0, player.shot_cooldown - dt)

                if inputs["left"]:
                    player.rotation -= PLAYER_TURN_SPEED * dt
                if inputs["right"]:
                    player.rotation += PLAYER_TURN_SPEED * dt
                if inputs["up"]:
                    forward = pygame.Vector2(0, -1).rotate(player.rotation)
                    player.position += forward * PLAYER_SPEED * dt
                if inputs["down"]:
                    backward = pygame.Vector2(0, 1).rotate(player.rotation)
                    player.position += backward * PLAYER_SPEED * dt
                if inputs["space"]:
                    player.shoot()

                wrap_position(player.position)

            status = run_game_step(dt, players)

            if status == "player_hit":
                game_phase = PHASE_GAME_OVER

        if connected_clients:
            state = {
                "players": [
                    [p.position.x, p.position.y, p.rotation]
                    for p in players.values()
                ],
                "asteroids": [
                    [a.position.x, a.position.y, a.radius]
                    for a in asteroids
                ],
                "shots": [
                    [s.position.x, s.position.y]
                    for s in shots
                ],
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
