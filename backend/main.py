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

PHASE_RUNNING = "running"
PHASE_GAME_OVER = "game_over"

SHIP_RADIUS = 10
VERSION = "v2"

world = None


def wrap_position(pos, w, h):
    if pos.x < -SHIP_RADIUS:
        pos.x = w + SHIP_RADIUS
    elif pos.x > w + SHIP_RADIUS:
        pos.x = -SHIP_RADIUS

    if pos.y < -SHIP_RADIUS:
        pos.y = h + SHIP_RADIUS
    elif pos.y > h + SHIP_RADIUS:
        pos.y = -SHIP_RADIUS


def create_world(w, h):
    global world

    updatable = pygame.sprite.Group()
    asteroids = pygame.sprite.Group()
    shots = pygame.sprite.Group()

    Player.containers = (updatable,)
    Asteroid.containers = (asteroids, updatable)
    Shot.containers = (shots, updatable)
    AsteroidField.containers = (updatable,)

    AsteroidField()

    world = {
        "updatable": updatable,
        "asteroids": asteroids,
        "shots": shots,
        "players": {},
        "phase": PHASE_RUNNING,
        "size": (w, h),
    }


def run_game_step(dt):
    updatable = world["updatable"]
    asteroids = world["asteroids"]
    shots = world["shots"]
    w, h = world["size"]

    updatable.update(dt)

    for asteroid in asteroids:
        wrap_position(asteroid.position, w, h)

    for player in world["players"].values():
        wrap_position(player.position, w, h)
        for asteroid in asteroids:
            if asteroid.collides_with(player):
                world["phase"] = PHASE_GAME_OVER

    for asteroid in list(asteroids):
        for shot in list(shots):
            if asteroid.collides_with(shot):
                shot.kill()
                asteroid.split()


async def game_loop(connected_clients, player_inputs):
    dt = 1 / 60

    while True:
        if world["phase"] == PHASE_RUNNING:
            for ws, player in world["players"].items():
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
                    if not player.fire_held:
                        player.shoot()
                        player.fire_held = True
                else:
                    player.fire_held = False

            run_game_step(dt)

        state = {
            "players": [
                [p.position.x, p.position.y, p.rotation]
                for p in world["players"].values()
            ],
            "asteroids": [
                [a.position.x, a.position.y, a.radius]
                for a in world["asteroids"]
            ],
            "shots": [
                [s.position.x, s.position.y]
                for s in world["shots"]
            ],
        }

        for ws in connected_clients:
            await ws.send(json.dumps({
                "type": "state",
                "version": VERSION,
                "phase": world["phase"],
                "world": list(world["size"]),
                "data": state,
            }))

        await asyncio.sleep(dt)
