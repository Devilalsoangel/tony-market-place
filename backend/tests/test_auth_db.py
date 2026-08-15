"""
Unit tests for auth_db.py
Run with: pytest backend/tests/test_auth_db.py
"""
import pytest
from datetime import datetime, timezone
from backend.auth_db import (
    hash_password,
    verify_password,
    create_user,
    get_user_by_email,
    get_user_by_id,
    authenticate_user,
    get_all_users,
)


class TestPasswordHashing:
    def test_hash_password_creates_valid_hash(self):
        """Test that password hashing works"""
        pwd = "Test@1234"
        hashed = hash_password(pwd)
        assert hashed != pwd
        assert "$" in hashed

    def test_verify_password_succeeds(self):
        """Test that a correct password verifies"""
        pwd = "Test@1234"
        hashed = hash_password(pwd)
        assert verify_password(pwd, hashed)

    def test_verify_password_fails_on_mismatch(self):
        """Test that an incorrect password fails"""
        pwd = "Test@1234"
        wrong_pwd = "Wrong@5678"
        hashed = hash_password(pwd)
        assert not verify_password(wrong_pwd, hashed)


class TestUserCreation:
    def test_create_user_succeeds(self):
        """Test creating a new user"""
        user = create_user(
            full_name="John Doe",
            username="johndoe",
            email="john@example.com",
            password="Secure@123",
        )
        assert user["username"] == "johndoe"
        assert user["email"] == "john@example.com"
        assert "password" not in user

    def test_get_user_by_email(self):
        """Test retrieving user by email"""
        create_user(
            full_name="Jane Doe",
            username="janedoe",
            email="jane@example.com",
            password="Secure@456",
        )
        user = get_user_by_email("jane@example.com")
        assert user is not None
        assert user["username"] == "janedoe"

    def test_authenticate_user_succeeds(self):
        """Test user authentication"""
        create_user(
            full_name="Auth User",
            username="authuser",
            email="auth@example.com",
            password="Auth@789",
        )
        user = authenticate_user("auth@example.com", "Auth@789")
        assert user is not None
        assert user["username"] == "authuser"

    def test_authenticate_user_fails_on_wrong_password(self):
        """Test that wrong password fails"""
        create_user(
            full_name="Bad Auth",
            username="badauth",
            email="bad@example.com",
            password="Correct@123",
        )
        user = authenticate_user("bad@example.com", "Wrong@123")
        assert user is None


class TestGetAllUsers:
    def test_get_all_users_returns_list(self):
        """Test that get_all_users returns a list"""
        users = get_all_users()
        assert isinstance(users, list)
        assert len(users) > 0  # At least demo users
