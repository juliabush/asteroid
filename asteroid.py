from constants import LINE_WIDTH

class Asteroid(CircleShape):
    def __init__(self, x, y, radius):
        super()__init__(velocity)
        self.x = x
        self.y = y
        self.radius = radius


    def draw(screen, "white", (0,0), radius, LINE_WIDTH):
        pygame.draw.circle(screen, "white", (0,0), radius, LINE_WIDTH)
    def update(self.velocity, dt):
        position += self.velocity * dt
        