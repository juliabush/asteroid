from constants import SCREEN_WIDTH, SCREEN_HEIGHT
from logger import log_state
from player import Player
import pygame

def main():
    print(f"Starting Asteroids with pygame version: {pygame.version.ver}, Screen width: {SCREEN_WIDTH} \n Screen height: {SCREEN_HEIGHT}")

    pygame.init()

    screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))

    clock = pygame.time.Clock()

    dt = 0

    x = SCREEN_WIDTH / 2
    y = SCREEN_HEIGHT / 2
    player_object = Player(x, y)

    while True:
        log_state()


        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return
        screen.fill("black")
        player_object.draw(screen)
        player_object.rotate(dt)
        pygame.display.flip()
        dt = clock.tick(60) / 1000

if __name__ == "__main__":
    main()
