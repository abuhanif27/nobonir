import os
import sys
import django
from unittest.mock import patch, MagicMock

def test_scenario(name, message, user, auth=True):
    print(f"\n--- Testing Scenario: {name} (Auth={auth}) ---")
    current_user = user if auth else MagicMock(is_authenticated=False)

    # We mock the LLM reply construction by checking the prompt if we could,
    # but for this test we'll just check the fallback logic and serialized data.
    # To test the serialized data, we need a mock request.
    request = MagicMock()
    request.user = current_user
    request.data = {}

    from ai_engine.services.chat_assistant_service import build_assistant_response_payload
    result = build_assistant_response_payload(current_user, message, request)

    print(f"User Message: {message}")
    print(f"Intent: {result['intent']}")
    print(f"AI Reply: {result['reply']}")
    print(f"Products suggested: {len(result['suggested_products'])}")

    if result['suggested_products']:
        p = result['suggested_products'][0]
        print(f"Top Product: {p['name']}")
        print(f"Available Stock (Serialized): {p.get('available_stock')}")
        # For guests, stock should be 0 or 1.
        if not auth:
            if p.get('available_stock') > 1:
                print("FAIL: Guest saw exact stock count!")
            else:
                print("PASS: Guest stock count is obfuscated.")
        else:
            print(f"PASS: Member saw exact stock count ({p.get('available_stock')}).")


def main():
    # Set DJANGO_SETTINGS_MODULE
    os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'
    sys.path.append(os.path.join(os.getcwd(), 'backend'))
    django.setup()

    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.first() or User.objects.create_user(email="pro_test@example.com", password="password")

    # 1. Greeting
    test_scenario("Greeting", "Hi there, how are you today?", user)

    # 2. Help/Capabilities
    test_scenario("Help Query", "What can you do for me?", user)

    # 3. Product inquiry
    test_scenario("Product Inquiry", "Do you have any air fryers in stock?", user)

    # 4. Budget search
    test_scenario("Budget Search", "I need a blender under 4000", user)

    # 5. Order help (Guest)
    test_scenario("Order Help (Guest)", "Where is my order?", user, auth=False)

    # 6. Order help (Auth)
    test_scenario("Order Help (Auth)", "Where is my order?", user, auth=True)


if __name__ == "__main__":
    main()
