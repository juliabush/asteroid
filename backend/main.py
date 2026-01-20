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

SHIP_RADIUS = 12

client_worlds = {}

def spawn_player(w, h):
    p = Player()
    p.position.x = w / 2
    p.position.y = h / 2
    return p

def wrap_position(pos, w, h):
    if pos.x < -SHIP_RADIUS:
        pos.x = w + SHIP_RADIUS
    elif pos.x > w + SHIP_RADIUS:
        pos.x = -SHIP_RADIUS

    if pos.y < -SHIP_RADIUS:
        pos.y = h + SHIP_RADIUS
    elif pos.y > h + SHIP_RADIUS:
        pos.y = -SHIP_RADIUS


def reset_game(players, player_inputs):
    global game_phase

    updatable.empty()
    drawable.empty()
    asteroids.empty()
    shots.empty()

    bind_containers()
    AsteroidField()

    for key in player_inputs:
        player_inputs[key] = {
            "up": False,
            "down": False,
            "left": False,
            "right": False,
            "space": False,
        }

    for player in players.values():
        player.shot_cooldown = 0
        player.fire_held = False

    game_phase = PHASE_RUNNING


def run_game_step(dt, players):
    updatable.update(dt)

    for asteroid in asteroids:
        wrap_position(asteroid.position, SCREEN_WIDTH, SCREEN_HEIGHT)


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
        for ws in list(player_inputs.keys()):
            try:
                msg = player_inputs[ws].get("_resize")
                if msg:
                    client_worlds[ws] = (msg["width"], msg["height"])
                    del player_inputs[ws]["_resize"]
            except Exception:
                pass

        for player in players.values():
            player.shot_cooldown = max(0, player.shot_cooldown - dt)

        if game_phase == PHASE_RUNNING:
            for ws, player in players.items():
                inputs = player_inputs.get(ws)
                if not inputs:
                    continue

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

                w, h = client_worlds.get(ws, (SCREEN_WIDTH, SCREEN_HEIGHT))
                wrap_position(player.position, SCREEN_WIDTH, SCREEN_HEIGHT)

            status = run_game_step(dt, players)

            if status == "player_hit":
                game_phase = PHASE_GAME_OVER

        for ws in connected_clients:
            w, h = client_worlds.get(ws, (SCREEN_WIDTH, SCREEN_HEIGHT))
            if ws not in players:
                players[ws] = spawn_player(w, h)



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
                "world": [w, h],
                "data": state
            })

            await ws.send(msg)

        await asyncio.sleep(dt)
