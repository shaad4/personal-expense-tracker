from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import ExpenseViewSet, health

router = SimpleRouter()
router.register("expenses", ExpenseViewSet)

urlpatterns = [path("health/", health, name="health"), *router.urls]
