from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class Student(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15)
    course = models.CharField(max_length=100)
    year = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    marks = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(100)])
    photo = models.ImageField(upload_to='student_photos/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name
