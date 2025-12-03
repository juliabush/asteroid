from constants import SCREEN_WIDTH, SCREEN_HEIGHT
from logger import log_state
import pygame

def main():
    print(f"Starting Asteroids with pygame version: {pygame.version.ver}, Screen width: {SCREEN_WIDTH} \n Screen height: {SCREEN_HEIGHT}")

    pygame.init()

if __name__ == "__main__":
    main()
