import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import {
  getErrorData,
  getErrorFieldMessages,
  getErrorMessage,
  getErrorStatus,
} from "@/lib/apiError";
import { useCartStore } from "@/lib/cart";
import { trackEvent } from "@/lib/analytics";
import { useCurrency } from "@/lib/currency";
import { useFeedback } from "@/lib/feedback";
import { animateFlyToCart } from "@/lib/flyToCart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FlowStateBanner, FlowStateCard } from "@/components/ui/flow-state";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  Tag,
  Edit2,
  Trash2,
} from "lucide-react";
import {
  useProduct,
  useProductReviews,
  useMyReviews,
  useReviewEligibility,
  ProductReview,
} from "@/hooks/useProducts";
import { useQueryClient } from "@tanstack/react-query";

type LocalCartItem = {
  variant_key?: string;
  variant_id?: number | null;
  variant?: {
    id: number;
    color?: string;
    size?: string;
  } | null;
  product?: {
    id?: number;
  };
  quantity?: number;
};

const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&h=700&fit=crop";

const extractImageCandidates = (value?: string) => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const getRatingLabel = (rating: number) => {
  if (rating === 5) return "⭐ Excellent";
  if (rating === 4) return "⭐ Good";
  if (rating === 3) return "⭐ Fair";
  if (rating === 2) return "⭐ Poor";
  return "⭐ Terrible";
};

export function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { cartCount, refreshCart } = useCartStore();
  const { formatPrice } = useCurrency();
  const { showError, showSuccess } = useFeedback();
  
  // React Query Hooks
  const { 
    data: product, 
    isLoading: productLoading, 
    isError: productError,
    error: productErrorObj 
  } = useProduct(id);
  
  const { 
    data: reviews = [], 
    isLoading: reviewsLoading, 
    isError: reviewsIsError
  } = useProductReviews(id);
  
  const { 
    data: myReviews = [], 
    isLoading: myReviewsLoading, 
    isError: myReviewsIsError,
    error: myReviewsErrorObj
  } = useMyReviews(isAuthenticated);

  const { 
    data: canReviewProduct = false,
    isLoading: checkingReviewEligibility
  } = useReviewEligibility(id, isAuthenticated);

  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [notifyChannel, setNotifyChannel] = useState<"EMAIL" | "WHATSAPP">("EMAIL");
  const [notifyContact, setNotifyContact] = useState("");
  const [notifyLoading, setNotifyLoading] = useState(false);
  
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [userReviewId, setUserReviewId] = useState<number | null>(null);
  
  const trackedProductViewRef = useRef<number | null>(null);

  useEffect(() => {
    void refreshCart(isAuthenticated);
  }, [isAuthenticated, refreshCart]);


  const currentProductId = Number(product?.id || 0);
  const currentUserReview = myReviews.find((review: ProductReview) => Number(review.product) === currentProductId);
  const hasReviewedProduct = !!currentUserReview;
  
  const reviewFormLocked =
    !isAuthenticated ||
    savingReview ||
    (!hasReviewedProduct && !canReviewProduct) ||
    (hasReviewedProduct && !isEditingReview);

  const handleRatingKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, value: number) => {
      if (reviewFormLocked) {
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        setReviewRating((prev) => Math.min(5, prev + 1));
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        setReviewRating((prev) => Math.max(1, prev - 1));
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setReviewRating(1);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setReviewRating(5);
        return;
      }

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setReviewRating(value);
      }
    },
    [reviewFormLocked],
  );

  const galleryImages = useMemo(() => {
    if (!product) {
      return [FALLBACK_PRODUCT_IMAGE];
    }

    const selectedVariant = (product.variants || []).find(
      (variant) =>
        (selectedColor ? variant.color === selectedColor : true) &&
        (selectedSize ? variant.size === selectedSize : true),
    );

    const selectedVariantMedia = selectedVariant?.media;
    const variantMedia: string[] = Array.isArray(selectedVariantMedia)
      ? [...selectedVariantMedia]
      : [];
    const genericMedia = (product.media || [])
      .filter((item) => !item.variant_id)
      .sort(
        (left, right) =>
          Number(Boolean(right.is_primary)) -
            Number(Boolean(left.is_primary)) ||
          (left.sort_order ?? 0) - (right.sort_order ?? 0),
      )
      .map((item) => item.url)
      .filter(Boolean);

    const merged = [
      ...variantMedia,
      ...genericMedia,
      ...extractImageCandidates(product.image_url),
      ...extractImageCandidates(product.image),
    ];

    const unique = Array.from(new Set(merged));
    return unique.length > 0 ? unique : [FALLBACK_PRODUCT_IMAGE];
  }, [product, selectedColor, selectedSize]);

  const colorOptions = useMemo(() => {
    const colors = (product?.variants || [])
      .map((variant) => variant.color || "")
      .filter(Boolean);
    return Array.from(new Set(colors));
  }, [product]);

  const sizeOptions = useMemo(() => {
    const sizes = (product?.variants || [])
      .filter((variant) =>
        selectedColor ? variant.color === selectedColor : true,
      )
      .map((variant) => variant.size || "")
      .filter(Boolean);
    return Array.from(new Set(sizes));
  }, [product, selectedColor]);

  useEffect(() => {
    setSelectedImage(galleryImages[0] || FALLBACK_PRODUCT_IMAGE);
  }, [galleryImages]);

  useEffect(() => {
    if (!product) return;
    if (!selectedColor && colorOptions[0]) setSelectedColor(colorOptions[0]);
    if (!selectedSize && sizeOptions[0]) setSelectedSize(sizeOptions[0]);
  }, [product, colorOptions, selectedColor, selectedSize, sizeOptions]);

  useEffect(() => {
    if (!product || isEditingReview) return;

    if (currentUserReview) {
      setUserReviewId(currentUserReview.id);
      setReviewRating(currentUserReview.rating || 5);
      setReviewComment(currentUserReview.comment || "");
    } else {
      setUserReviewId(null);
      setReviewRating(5);
      setReviewComment("");
    }
  }, [product, currentUserReview, isEditingReview]);

  useEffect(() => {
    if (!product) return;
    if (trackedProductViewRef.current === product.id) return;

    trackedProductViewRef.current = product.id;
    void trackEvent("view_product", {
      product_id: product.id,
      category_id: product.category?.id,
      price: product.price,
      stock: product.stock,
    });

    if (window.location.hash === "#share-feedback") {
      window.setTimeout(() => {
        document.getElementById("share-feedback")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      if (hasReviewedProduct) setIsEditingReview(true);
    }
  }, [product, hasReviewedProduct]);

  const addToCart = async (sourceElement?: HTMLElement) => {
    if (!product) return;

    const productImage = selectedImage || product.image_url || product.image || FALLBACK_PRODUCT_IMAGE;

    animateFlyToCart({
      fromElement: sourceElement,
      imageSrc: productImage,
    });

    const selectedVariant = (product.variants || []).find(
      (variant) =>
        (selectedColor ? variant.color === selectedColor : true) &&
        (selectedSize ? variant.size === selectedSize : true),
    );
    const selectedVariantId = selectedVariant?.id || null;
    const variantKey = selectedVariantId ? `${product.id}:${selectedVariantId}` : `${product.id}:default`;

    const addToLocalDemoCart = () => {
      const key = "nobonir_demo_cart";
      const existingRaw = localStorage.getItem(key);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const existingIndex = existing.findIndex((item: LocalCartItem) => item.variant_key === variantKey);

      if (existingIndex >= 0) {
        existing[existingIndex].quantity += quantity;
      } else {
        existing.push({
          id: product.id,
          quantity,
          isLocal: true,
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            image: productImage,
            stock: product.stock,
          },
          variant_key: variantKey,
          variant_id: selectedVariantId,
          variant: selectedVariantId ? { id: selectedVariantId, color: selectedVariant?.color, size: selectedVariant?.size } : null,
        });
      }
      localStorage.setItem(key, JSON.stringify(existing));
    };

    let cartMode: "server" | "local" = isAuthenticated ? "server" : "local";
    if (isAuthenticated) {
      try {
        await api.post("/cart/items/", {
          product_id: product.id,
          variant_id: selectedVariantId,
          quantity,
        });
      } catch (error: unknown) {
        console.warn("Failed to add to server cart, using local backup", error);
        cartMode = "local";
      }
    }

    // Always ensure item is in local cache as backup
    addToLocalDemoCart();
    await refreshCart(isAuthenticated);
    void trackEvent("add_to_cart", {
      product_id: product.id,
      variant_id: selectedVariantId,
      quantity,
      stock: product.stock,
      cart_mode: cartMode,
      is_authenticated: isAuthenticated,
    });
  };

  const submitStockNotification = async () => {
    if (!product) return;
    if (!notifyContact.trim()) {
      showError("Please enter your email or WhatsApp number.");
      return;
    }

    setNotifyLoading(true);
    try {
      await api.post(`/products/${product.id}/notify-stock/`, {
        channel: notifyChannel,
        contact_value: notifyContact.trim(),
      });
      showSuccess("We will notify you when this product is back in stock.");
      setNotifyContact("");
    } catch (error: unknown) {
      showError(getErrorMessage(error, "Failed to save stock notification."));
    } finally {
      setNotifyLoading(false);
    }
  };

  const submitReview = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      showError("Please sign in to submit a review");
      return;
    }
    if (!hasReviewedProduct && !canReviewProduct) {
      showError("You can review only products from your delivered orders");
      return;
    }

    setSavingReview(true);
    try {
      if ((isEditingReview || hasReviewedProduct) && userReviewId) {
        await api.patch(`/reviews/my/${userReviewId}/`, {
          rating: reviewRating,
          comment: reviewComment,
        });
        showSuccess("Review updated successfully");
      } else {
        await api.post("/reviews/", {
          product: product.id,
          rating: reviewRating,
          comment: reviewComment,
        });
        showSuccess("Review submitted successfully");
      }

      setReviewComment("");
      setReviewRating(5);
      setIsEditingReview(false);
      setUserReviewId(null);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["reviews", String(product.id)] });
      queryClient.invalidateQueries({ queryKey: ["myReviews"] });
      
    } catch (error: unknown) {
      const data = getErrorData(error);
      const productError = getErrorFieldMessages(error, "product")[0];
      showError((typeof data?.detail === "string" && data.detail) || productError || "Failed to submit review");
    } finally {
      setSavingReview(false);
    }
  };

  const deleteReview = async () => {
    if (!userReviewId || !product) return;
    if (!window.confirm("Are you sure you want to delete your review?")) return;

    setSavingReview(true);
    try {
      await api.delete(`/reviews/my/${userReviewId}/`);
      showSuccess("Review deleted successfully");
      setReviewComment("");
      setReviewRating(5);
      setIsEditingReview(false);
      setUserReviewId(null);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["reviews", String(product.id)] });
      queryClient.invalidateQueries({ queryKey: ["myReviews"] });
      
    } catch (error: unknown) {
      showError(getErrorMessage(error, "Failed to delete review"));
    } finally {
      setSavingReview(false);
    }
  };

  if (productLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <main id="main-content" className="mx-auto max-w-4xl">
          <FlowStateCard message="Loading product..." contentClassName="py-12" />
        </main>
      </div>
    );
  }

  if (productError || !product) {
    // Determine if it's a 404 or other error
    // In useQuery, if retry returns false for 404, we can assume 404
    // But error object might have status
    const isNotFound = getErrorStatus(productErrorObj) === 404;
    
    return (
      <div className="min-h-screen bg-background">
        <main id="main-content" className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <FlowStateCard
            title={isNotFound ? "Product not found" : "Can’t load product right now"}
            message={isNotFound ? "This product is unavailable right now." : "Server is temporarily unavailable. Please try again."}
            actionLabel={isNotFound ? "Back to Products" : "Try Again"}
            onAction={() => {
              if (isNotFound) {
                navigate("/");
              } else {
                queryClient.invalidateQueries({ queryKey: ["product", id] });
              }
            }}
            children={isNotFound ? (
                <div className="mt-3">
                  <Link to="/">
                    <Button><ArrowLeft className="mr-2 h-4 w-4" />Back to Products</Button>
                  </Link>
                </div>
              ) : null
            }
            contentClassName="py-12"
          />
        </main>
      </div>
    );
  }

  const productImage = selectedImage || product.image_url || product.image || FALLBACK_PRODUCT_IMAGE;
  const averageRating = reviews.length > 0
      ? reviews.reduce((sum: number, review: ProductReview) => sum + Number(review.rating || 0), 0) / reviews.length
      : 0;
  const reviewRatingLabel = getRatingLabel(reviewRating);

  return (
    <div className="ds-page bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="ds-page-header">
        <div className="ds-page-header-row">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Link to="/cart">
            <Button variant="outline" className="relative" data-cart-nav="true">
              <ShoppingCart className="mr-2 h-4 w-4" />
              View Cart
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-8 sm:pb-10 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-xl">
              <img
                src={productImage}
                alt={product.name}
                className="h-72 w-full object-contain bg-background p-4 sm:h-96 lg:h-[520px]"
              />
            </div>

            {galleryImages.length > 1 && (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Product image gallery">
                {galleryImages.map((image, index) => {
                  const isActive = image === productImage;
                  const moveSelection = (nextIndex: number) => {
                    const boundedIndex = (nextIndex + galleryImages.length) % galleryImages.length;
                    setSelectedImage(galleryImages[boundedIndex]);
                  };

                  const handleGalleryKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
                    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                      event.preventDefault();
                      moveSelection(index + 1);
                      return;
                    }

                    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                      event.preventDefault();
                      moveSelection(index - 1);
                      return;
                    }

                    if (event.key === "Home") {
                      event.preventDefault();
                      moveSelection(0);
                      return;
                    }

                    if (event.key === "End") {
                      event.preventDefault();
                      moveSelection(galleryImages.length - 1);
                    }
                  };

                  return (
                    <button
                      key={`gallery-image-${index}`}
                      type="button"
                      className={`overflow-hidden rounded-md border bg-card p-1 transition ${isActive ? "border-primary ring-2 ring-primary/30" : "border-border/60"}`}
                      onClick={() => setSelectedImage(image)}
                      onKeyDown={handleGalleryKeyDown}
                      role="radio"
                      aria-checked={isActive}
                      tabIndex={isActive ? 0 : -1}
                      aria-label={`View product image ${index + 1}`}
                    >
                      <img src={image} alt={`${product.name} preview ${index + 1}`} className="h-14 w-full object-cover sm:h-16" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Card className="bg-card/95 shadow-xl lg:sticky lg:top-24 lg:self-start">
            <CardContent className="p-4 sm:p-7">
              <Badge variant="secondary" className="mb-4 gap-1.5">
                <Tag className="h-3 w-3" />
                {product.category.name}
              </Badge>

              <h1 className="mb-4 text-3xl font-black text-foreground sm:text-4xl">{product.name}</h1>
              <p className="text-muted-foreground leading-relaxed mb-6">{product.description}</p>
              <p className="text-4xl font-black bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent mb-6">
                {formatPrice(product.price)}
              </p>
              <p className="text-sm text-muted-foreground mb-6">Stock: {product.available_stock ?? product.stock}</p>

              {colorOptions.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground mb-2">Color</p>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <Button
                        key={color}
                        type="button"
                        size="sm"
                        variant={selectedColor === color ? "default" : "outline"}
                        onClick={() => setSelectedColor(color)}
                      >
                        {color}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {sizeOptions.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm text-muted-foreground mb-2">Size</p>
                  <div className="flex flex-wrap gap-2">
                    {sizeOptions.map((size) => (
                      <Button
                        key={size}
                        type="button"
                        size="sm"
                        variant={selectedSize === size ? "default" : "outline"}
                        onClick={() => setSelectedSize(size)}
                      >
                        {size}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-2">Quantity</p>
                <div className="inline-flex items-center rounded-lg border bg-background">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-r-none"
                    onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-semibold">{quantity}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-l-none"
                    onClick={() => setQuantity((prev) => Math.min(product.available_stock ?? product.stock ?? 1, prev + 1))}
                    disabled={quantity >= (product.available_stock ?? product.stock) || (product.available_stock ?? product.stock) === 0}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                <Button
                  onClick={(e) => addToCart(e.currentTarget)}
                  disabled={(product.available_stock ?? product.stock) === 0}
                  className="bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-600 hover:from-teal-600 hover:via-cyan-700 hover:to-blue-700"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {(product.available_stock ?? product.stock) === 0 ? "Unavailable" : "Add to Cart"}
                </Button>
                <Button variant="outline" onClick={() => navigate("/wishlist")}>
                  <Heart className="mr-2 h-4 w-4" />
                  Wishlist
                </Button>
              </div>

              {(product.available_stock ?? product.stock) === 0 && (
                <div className="mt-5 space-y-2 rounded-lg border border-border/60 p-3">
                  <p className="text-sm font-semibold text-foreground">Notify me when back in stock</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant={notifyChannel === "EMAIL" ? "default" : "outline"} onClick={() => setNotifyChannel("EMAIL")}>Email</Button>
                    <Button size="sm" variant={notifyChannel === "WHATSAPP" ? "default" : "outline"} onClick={() => setNotifyChannel("WHATSAPP")}>WhatsApp</Button>
                  </div>
                  <Textarea
                    rows={1}
                    placeholder={notifyChannel === "EMAIL" ? "you@example.com" : "+8801XXXXXXXXX"}
                    value={notifyContact}
                    onChange={(event) => setNotifyContact(event.target.value)}
                  />
                  <Button type="button" onClick={submitStockNotification} disabled={notifyLoading} className="w-full">
                    {notifyLoading ? "Saving..." : "Notify Me"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 lg:mt-8 lg:grid-cols-2 lg:gap-6">
          <Card id="share-feedback" className="bg-card/95 shadow-xl">
            <CardContent className="p-5 sm:p-6" aria-busy={reviewsLoading}>
              <h3 className="text-xl font-bold text-foreground">Customer Reviews</h3>

              {reviewsLoading ? (
                <FlowStateBanner className="mt-3" tone="info" message="Loading customer reviews..." />
              ) : reviewsIsError ? (
                <FlowStateBanner className="mt-3" tone="error" message="Couldn’t load customer reviews." actionLabel="Try Again" onAction={() => queryClient.invalidateQueries({ queryKey: ["reviews", id] })} />
              ) : (
                <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-3">
                  <p className="text-2xl font-bold text-foreground">
                    {reviews.length > 0 ? averageRating.toFixed(1) : "0.0"}
                    <span className="ml-1 text-sm font-medium text-muted-foreground">/ 5</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{reviews.length > 0 ? `${reviews.length} customer review(s)` : "No reviews yet"}</p>
                </div>
              )}

              <div className="mt-4"><p className="text-sm font-semibold text-foreground">Recent reviews</p></div>

              <div className="mt-3 space-y-3">
                {!reviewsLoading && !reviewsIsError && reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Be the first to review this product.</p>
                ) : !reviewsLoading && !reviewsIsError ? (
                  reviews.map((review: ProductReview) => (
                    <div key={review.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{review.user_name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star key={`star-${review.id}-${index}`} className={`h-4 w-4 ${index < review.rating ? "fill-current" : "opacity-30"}`} aria-hidden="true" />
                        ))}
                      </div>
                      {review.comment && <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>}
                    </div>
                  ))
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/95 shadow-xl">
            <CardContent className="p-5 sm:p-6">
              <h3 className="text-xl font-bold text-foreground">Share Your Feedback</h3>
              <p className="mt-1 text-sm text-muted-foreground">Help other customers by sharing your experience with this product.</p>

              {!isAuthenticated && (
                <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-300">
                  <p className="font-medium">Sign in to review</p>
                  <p className="mt-1">You must be logged in to leave a review.</p>
                </div>
              )}

              {isAuthenticated && !hasReviewedProduct && !canReviewProduct && (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  <p className="font-medium">Verified purchase required</p>
                  <p className="mt-1">You can review this product after receiving a delivered order containing it.</p>
                </div>
              )}

              {isAuthenticated && !hasReviewedProduct && canReviewProduct && (
                <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                  <p className="font-medium">✓ You can review this product</p>
                  <p className="mt-1">Your delivered order includes this item. Share your feedback below.</p>
                </div>
              )}

              {isAuthenticated && hasReviewedProduct && (
                <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                  <p className="font-medium">✓ You've reviewed this product</p>
                  <p className="mt-1">You can edit or delete your review below.</p>
                </div>
              )}

              {checkingReviewEligibility && isAuthenticated && <FlowStateBanner className="mt-3" tone="info" message="Checking review eligibility..." />}
              {isAuthenticated && myReviewsLoading && <FlowStateBanner className="mt-3" tone="info" message="Loading your review data..." />}
              {isAuthenticated && myReviewsIsError && <FlowStateBanner className="mt-3" tone="error" message={getErrorMessage(myReviewsErrorObj, "Error") } actionLabel="Try Again" onAction={() => queryClient.invalidateQueries({ queryKey: ["myReviews"] })} />}

              <div className="mt-6 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">Your Rating</label>
                    <span className="text-sm font-medium text-amber-500">{reviewRatingLabel}</span>
                  </div>
                  <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-4">
                    <div className="flex items-center gap-2" role="radiogroup" aria-label="Choose rating from 1 to 5 stars">
                      {Array.from({ length: 5 }).map((_, index) => {
                        const value = index + 1;
                        const active = (reviewHoverRating || reviewRating) >= value;
                        return (
                          <button
                            key={`write-review-star-${value}`}
                            type="button"
                            onMouseEnter={() => setReviewHoverRating(value)}
                            onMouseLeave={() => setReviewHoverRating(0)}
                            onClick={() => setReviewRating(value)}
                            onKeyDown={(event) => handleRatingKeyDown(event, value)}
                            disabled={reviewFormLocked}
                            role="radio"
                            aria-checked={reviewRating === value}
                            className="rounded-lg p-2 transition-transform duration-200 hover:scale-125 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                          >
                            <Star className={`h-7 w-7 transition-all duration-200 ${active ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" : "text-muted-foreground"}`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">Your Review</label>
                    <span className="text-xs text-muted-foreground">{reviewComment.length}/500</span>
                  </div>
                  <Textarea
                    rows={4}
                    placeholder="What did you like? What could be improved? (Optional)"
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value.slice(0, 500))}
                    disabled={reviewFormLocked}
                    className="mt-2"
                  />
                </div>
                <Button
                  onClick={submitReview}
                  disabled={reviewFormLocked || myReviewsLoading || myReviewsIsError}
                  className="w-full bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-600 hover:from-teal-600 hover:via-cyan-700 hover:to-blue-700"
                >
                  {savingReview ? (isEditingReview ? "Updating..." : "Submitting...") : myReviewsLoading ? "Loading..." : isEditingReview ? "Update Review" : hasReviewedProduct ? "Click Edit Review to Update" : isAuthenticated && !hasReviewedProduct && !canReviewProduct ? "Delivered Order Required" : isAuthenticated ? "Submit Review" : "Login to Review"}
                </Button>

                {isAuthenticated && hasReviewedProduct && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={() => setIsEditingReview(!isEditingReview)} variant="outline" className="flex-1" disabled={savingReview}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      {isEditingReview ? "Cancel Edit" : "Edit Review"}
                    </Button>
                    <Button onClick={deleteReview} variant="outline" className="flex-1 border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-400" disabled={savingReview}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="truncate text-base font-bold text-foreground">{formatPrice(product.price)}</p>
          </div>
          <Button onClick={(e) => addToCart(e.currentTarget)} disabled={(product.available_stock ?? product.stock) === 0} className="min-w-36 bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-600 hover:from-teal-600 hover:via-cyan-700 hover:to-blue-700">
            <ShoppingCart className="mr-2 h-4 w-4" />
            {(product.available_stock ?? product.stock) === 0 ? "Unavailable" : "Add to Cart"}
          </Button>
        </div>
      </div>
    </div>
  );
}
