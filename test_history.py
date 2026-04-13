import os
import sys
import django
from unittest.mock import patch, MagicMock

def main():
    # Set DJANGO_SETTINGS_MODULE
    os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'
    sys.path.append(os.path.join(os.getcwd(), 'backend'))
    django.setup()

    from ai_engine.services.chat_assistant_service import build_assistant_response_payload
    from ai_engine.models import AssistantChatSession
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.first() or User.objects.create_user(email="test@example.com", password="password")

    # Clear history for test
    AssistantChatSession.objects.all().delete()

    # Mock request.data and request.user
    request = MagicMock()
    request.data = {"session_key": "test_session"}
    request.user = user

    print("First message...")
    resp1 = build_assistant_response_payload(user, "Hi, I'm looking for an air fryer.", request)
    print(f"Reply 1: {resp1['reply']}")
    session_key = resp1['session_key']

    print("\nSecond message (checking context)...")
    request.data = {"session_key": session_key}

    # Mocking _build_llm_prompt to see the prompt
    with patch('ai_engine.services.chat_assistant_service._build_llm_prompt') as mock_prompt:
        mock_prompt.return_value = "Mocked Prompt"
        with patch('ai_engine.services.chat_assistant_service._pollinations_reply', return_value="Mocked LLM Reply"):
            build_assistant_response_payload(user, "What about under 5000?", request)

            # Check if history was passed to _build_llm_prompt
            args, kwargs = mock_prompt.call_args
            history = kwargs.get('history')
            print(f"History in prompt context: {len(history) if history else 'None'} messages")
            if history:
                for i, msg in enumerate(history):
                    print(f" - {msg['role']}: {msg['text'][:30]}...")

    print("\nHistory persistence check OK if history length > 1")


if __name__ == "__main__":
    main()
