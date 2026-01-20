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

SHIP_RADIUS = 12

client_worlds = {}
worlds = {}

def wrap_position(pos, w, h):
    if pos.x < -SHIP_RADIUS:
        pos.x = w + SHIP_RADIUS
    elif pos.x > w + SHIP_RADIUS:
        pos.x = -SHIP_RADIUS

    if pos.y < -SHIP_RADIUS:
        pos.y = h + SHIP_RADIUS
    elif pos.y > h + SHIP_RADIUS:
        pos.y = -SHIP_RADIUS


def create_world(ws, w, h):
    updatable = pygame.sprite.Group()
    asteroids = pygame.sprite.Group()
    shots = pygame.sprite.Group()

    Player.containers = (updatable,)
    Asteroid.containers = (asteroids, updatable)
    Shot.containers = (shots, updatable)
    AsteroidField.containers = (updatable,)

    AsteroidField()

    worlds[ws] = {
        "updatable": updatable,
        "asteroids": asteroids,
        "shots": shots,
        "phase": PHASE_RUNNING,
    }

    p = Player()
    p.position.x = w / 2
    p.position.y = h / 2
    p.shot_cooldown = 0
    p.fire_held = False

    return p


def reset_world(ws):
    w, h = client_worlds[ws]
    worlds.pop(ws, None)
    return create_world(ws, w, h)


def run_game_step(dt, ws, player):
    world = worlds[ws]
    updatable = world["updatable"]
    asteroids = world["asteroids"]
    shots = world["shots"]

    updatable.update(dt)

    w, h = client_worlds[ws]

    for asteroid in asteroids:
        wrap_position(asteroid.position, w, h)

    for asteroid in list(asteroids):
        if asteroid.collides_with(player):
            world["phase"] = PHASE_GAME_OVER
            return

    for asteroid in list(asteroids):
        for shot in list(shots):
            if asteroid.collides_with(shot):
                shot.kill()
                asteroid.split()


async def game_loop(connected_clients, players, player_inputs):
    dt = 1 / 60

    while True:
        for ws in list(player_inputs.keys()):
            resize = player_inputs[ws].pop("_resize", None)
            if resize:
                client_worlds[ws] = (resize["width"], resize["height"])
                players[ws] = reset_world(ws)

        for ws, player in players.items():
            world = worlds[ws]
            if world["phase"] != PHASE_RUNNING:
                continue

            inputs = player_inputs[ws]

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

            wrap_position(player.position, *client_worlds[ws])

            run_game_step(dt, ws, player)

        for ws in connected_clients:
            world = worlds[ws]
            w, h = client_worlds[ws]

            state = {
                "players": [[
                    players[ws].position.x,
                    players[ws].position.y,
                    players[ws].rotation,
                ]],
                "asteroids": [
                    [a.position.x, a.position.y, a.radius]
                    for a in world["asteroids"]
                ],
                "shots": [
                    [s.position.x, s.position.y]
                    for s in world["shots"]
                ],
            }

            await ws.send(json.dumps({
                "type": "state",
                "phase": world["phase"],
                "world": [w, h],
                "data": state,
            }))

        await asyncio.sleep(dt)
