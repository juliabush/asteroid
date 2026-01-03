import pygame
import random
from backend.circleshape import CircleShape
from backend.logger import log_event
from backend.constants import LINE_WIDTH, WHITE, ASTEROID_MIN_RADIUS

class Asteroid(CircleShape):
    containers = ()

    def __init__(self, x, y, radius):
        super().__init__(x, y, radius)


    def draw(self, screen):
        pygame.draw.circle(screen, WHITE, self.position, self.radius, LINE_WIDTH)
    def update(self, dt):
        self.position += self.velocity * dt
    def split(self):
        self.kill()
        if self.radius <= ASTEROID_MIN_RADIUS:
            return
        else:
            log_event("asteroid_split")
            angle = random.uniform(20, 50)
            first_vector = self.velocity.rotate(+angle)
            second_vector = self.velocity.rotate(-angle)
            old_radius = self.radius
            new_radius = old_radius - ASTEROID_MIN_RADIUS
            first_asteroid = Asteroid(self.position.x, self.position.y, new_radius)
            second_asteroid = Asteroid(self.position.x, self.position.y, new_radius)
            first_asteroid.velocity = first_vector * 1.2
            second_asteroid.velocity = second_vector * 1.2