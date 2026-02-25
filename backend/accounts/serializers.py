from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role"]
        read_only_fields = ["id", "role"]


class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["username", "email", "password", "first_name", "last_name"]

    def validate(self, attrs):
        username = (attrs.get("username") or "").strip()
        if username:
            attrs["username"] = username
            return attrs

        email = attrs.get("email", "")
        base_username = (email.split("@", 1)[0] or "user").strip()
        candidate = base_username
        suffix = 1

        while User.objects.filter(username=candidate).exists():
            suffix += 1
            candidate = f"{base_username}{suffix}"

        attrs["username"] = candidate
        return attrs

    def create(self, validated_data):
        user = User(
            username=validated_data["username"],
            email=validated_data["email"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            role=User.Role.CUSTOMER,
        )
        user.set_password(validated_data["password"])
        user.save()
        return user
