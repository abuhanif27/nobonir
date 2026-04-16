from django.contrib.auth import get_user_model
from datetime import date
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "profile_picture",
            "phone_number",
            "address",
            "date_of_birth",
            "gender",
            "date_joined",
        ]
        read_only_fields = ["id", "role", "date_joined"]


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "profile_picture",
            "phone_number",
            "address",
            "date_of_birth",
            "gender",
        ]

    def validate_profile_picture(self, value):
        if not value:
            return value

        allowed_types = {"image/jpeg", "image/png", "image/webp"}
        content_type = (getattr(value, "content_type", "") or "").lower()
        if content_type and content_type not in allowed_types:
            raise serializers.ValidationError("Unsupported image type. Use JPG, PNG, or WEBP.")

        max_size = 2 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("Profile picture size must be 2MB or less.")

        return value
        

class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect")
        return value

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)
    date_of_birth = serializers.DateField(required=True)
    gender = serializers.ChoiceField(choices=User.Gender.choices, required=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "date_of_birth",
            "gender",
        ]

    def validate_date_of_birth(self, value):
        today = date.today()
        if value > today:
            raise serializers.ValidationError("Date of birth cannot be in the future")

        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 13:
            raise serializers.ValidationError("You must be at least 13 years old to register")

        return value

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
            date_of_birth=validated_data["date_of_birth"],
            gender=validated_data["gender"],
            role=User.Role.CUSTOMER,
        )
        user.set_password(validated_data["password"])
        user.save()
        return user


class EmailTokenObtainSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        password = attrs["password"]

        user = User.objects.filter(email__iexact=email).first()
        if not user or not user.check_password(password) or not user.is_active:
            raise serializers.ValidationError(
                {"detail": "No active account found with the given credentials"}
            )

        refresh = RefreshToken.for_user(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": UserSerializer(user).data,
        }


class PasswordResetRequestSerializer(serializers.Serializer):
    """Request password reset via email."""
    email = serializers.EmailField()

    def validate_email(self, value):
        normalized_email = value.strip().lower()
        if not User.objects.filter(email__iexact=normalized_email).exists():
            # Don't reveal if email exists for security
            pass
        return normalized_email


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Reset password using token from email."""
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        from accounts.models import PasswordResetToken
        
        token = attrs.get('token', '').strip()
        try:
            reset_token = PasswordResetToken.objects.get(token=token)
            if not reset_token.is_valid():
                raise serializers.ValidationError("This password reset link has expired or has already been used.")
        except PasswordResetToken.DoesNotExist:
            raise serializers.ValidationError("Invalid password reset token.")
        
        attrs['reset_token'] = reset_token
        return attrs

    def save(self):
        user = self.validated_data['reset_token'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        
        # Mark token as used
        self.validated_data['reset_token'].mark_used()
        
        return user


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
        ]
        read_only_fields = ["id", "email", "username", "is_superuser", "date_joined"]


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["role", "is_active", "is_staff"]

    def validate_role(self, value):
        valid_roles = {choice[0] for choice in User.Role.choices}
        if value not in valid_roles:
            raise serializers.ValidationError("Invalid role")
        return value
