import csv
from django.http import HttpResponse
from django.db.models import Avg, Count
from rest_framework import viewsets, status, generics, permissions
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.filters import SearchFilter
from rest_framework.permissions import AllowAny

from .models import Student
from .serializers import StudentSerializer, RegisterSerializer


class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register/  -> create a new user account"""
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class StudentViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for Student, plus:
      GET /api/students/stats/   -> dashboard stats
      GET /api/students/export/  -> CSV export
    Requires a valid JWT access token (Authorization: Bearer <token>).
    """
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [SearchFilter]
    search_fields = ['name', 'email', 'course']

    def get_queryset(self):
        qs = Student.objects.all()
        course = self.request.query_params.get('course')
        year = self.request.query_params.get('year')
        if course:
            qs = qs.filter(course__icontains=course)
        if year:
            qs = qs.filter(year=year)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_update(serializer)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({"message": "Student deleted successfully."}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Dashboard statistics: totals, average marks, course-wise counts."""
        qs = Student.objects.all()
        total = qs.count()
        avg_marks = qs.aggregate(avg=Avg('marks'))['avg'] or 0
        course_counts = list(qs.values('course').annotate(count=Count('id')).order_by('-count'))
        year_counts = list(qs.values('year').annotate(count=Count('id')).order_by('year'))
        top_student = qs.order_by('-marks').first()
        return Response({
            'total_students': total,
            'average_marks': round(avg_marks, 2),
            'course_distribution': course_counts,
            'year_distribution': year_counts,
            'top_student': StudentSerializer(top_student, context={'request': request}).data if top_student else None,
        })

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export all students as a downloadable CSV file."""
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="students_export.csv"'
        writer = csv.writer(response)
        writer.writerow(['ID', 'Name', 'Email', 'Phone', 'Course', 'Year', 'Marks', 'Created At'])
        for s in Student.objects.all():
            writer.writerow([s.id, s.name, s.email, s.phone, s.course, s.year, s.marks, s.created_at])
        return response
