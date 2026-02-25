"""Helper utilities for cart management"""

from .models import Cart


def get_or_create_cart_for_request(request):
    """
    Get or create cart for the current request.
    - For authenticated users: use user-based cart
    - For guests: use session-based cart
    
    Returns:
        tuple: (cart, created)
    """
    if request.user.is_authenticated:
        # Authenticated user - use user-based cart
        return Cart.objects.get_or_create(user=request.user)
    else:
        # Guest user - use session-based cart
        if not request.session.session_key:
            request.session.create()
        session_key = request.session.session_key
        
        # Try to find existing guest cart
        cart = Cart.objects.filter(session_key=session_key, user__isnull=True).first()
        if cart:
            return cart, False
        
        # Create new guest cart
        cart = Cart.objects.create(session_key=session_key)
        return cart, True


def merge_guest_cart_to_user(session_key, user):
    """
    Merge guest cart items into user's cart when they log in.
    
    Args:
        session_key: The session key of the guest cart
        user: The authenticated user
    """
    from .models import CartItem
    
    # Get or create user cart
    user_cart, _ = Cart.objects.get_or_create(user=user)
    
    # Find guest cart
    guest_cart = Cart.objects.filter(session_key=session_key, user__isnull=True).first()
    if not guest_cart:
        return
    
    # Merge cart items
    guest_items = CartItem.objects.filter(cart=guest_cart).select_related('product')
    
    for guest_item in guest_items:
        user_item, created = CartItem.objects.get_or_create(
            cart=user_cart,
            product=guest_item.product,
            defaults={'quantity': guest_item.quantity}
        )
        if not created:
            # Item already exists in user cart - add quantities
            user_item.quantity += guest_item.quantity
            user_item.save(update_fields=['quantity', 'updated_at'])
    
    # Delete guest cart and its items
    guest_cart.delete()
