import pygame
from backend.circleshape import CircleShape
from backend.constants import LINE_WIDTH, WHITE, SHOT_RADIUS

class Shot(CircleShape):
    containers = ()

    def __init__(self, x, y):
        super().__init__(x, y, SHOT_RADIUS)


    def draw(self, screen):
        pygame.draw.circle(screen, WHITE, self.position, self.radius, LINE_WIDTH)
    def update(self, dt):
        self.position += self.velocity * dt