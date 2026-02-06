import pygame
import random
from circleshape import CircleShape
from logger import log_event
from constants import LINE_WIDTH, WHITE, ASTEROID_MIN_RADIUS

class Asteroid(CircleShape):
    containers = ()
    _id_counter = 0

    def __init__(self, x, y, radius):
        super().__init__(x, y, radius)
        self.id = Asteroid._id_counter
        Asteroid._id_counter += 1


    def draw(self, screen):
        pygame.draw.circle(screen, WHITE, self.position, self.radius, LINE_WIDTH)
    def update(self, dt):
        self.position += self.velocity * dt

    def split(self):
        self.kill()

        if self.radius <= ASTEROID_MIN_RADIUS:
            return

        angle = random.uniform(20, 50)
        old_radius = self.radius
        new_radius = old_radius - ASTEROID_MIN_RADIUS

        offset = pygame.Vector2(1, 0).rotate(random.uniform(0, 360)) * new_radius

        first_asteroid = Asteroid(
            self.position.x + offset.x,
            self.position.y + offset.y,
            new_radius
        )
        second_asteroid = Asteroid(
            self.position.x - offset.x,
            self.position.y - offset.y,
            new_radius
        )

        first_asteroid.velocity = self.velocity.rotate(+angle) * 1.2
        second_asteroid.velocity = self.velocity.rotate(-angle) * 1.2
