import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import {
  getErrorData,
  getErrorMessage,
  getErrorFieldMessages,
} from "@/lib/apiError";
import { useFeedback } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowStateCard } from "@/components/ui/flow-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Category {
  id: number;
  name: string;
}

interface ProductPayload {
  category_id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  stock: string;
  is_active: boolean;
}

interface ProductVariant {
  id: number;
  color?: string;
  size?: string;
  sku?: string;
  stock?: number | null;
  stock_override?: number | null;
}

interface ProductMedia {
  id: number;
  url: string;
  alt_text?: string;
  sort_order?: number;
  is_primary?: boolean;
  variant_id?: number | null;
}

interface VariantDraft {
  color: string;
  size: string;
  sku: string;
  stock_override: string;
}

interface MediaDraft {
  image_url: string;
  alt_text: string;
  sort_order: string;
  is_primary: boolean;
  variant_id: string;
}

interface VariantFormPayload {
  color: string;
  size: string;
  sku: string;
  stock_override: string;
}

interface MediaFormPayload {
  image_url: string;
  alt_text: string;
  sort_order: string;
  is_primary: boolean;
  variant_id: string;
}

type PendingDeleteAction =
  | {
      type: "variant";
      id: number;
      title: string;
      message: string;
    }
  | {
      type: "media";
      id: number;
      title: string;
      message: string;
    };

const EMPTY_FORM: ProductPayload = {
  category_id: "",
  name: "",
  slug: "",
  description: "",
  price: "",
  stock: "0",
  is_active: true,
};

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function AdminProductFormPage() {
  const { id } = useParams();
  const isEditMode = Boolean(id && id !== "new");
  const navigate = useNavigate();
  const { showError, showSuccess } = useFeedback();

  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<ProductPayload>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [formLoadError, setFormLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [mediaItems, setMediaItems] = useState<ProductMedia[]>([]);
  const [variantForm, setVariantForm] = useState<VariantFormPayload>({
    color: "",
    size: "",
    sku: "",
    stock_override: "",
  });
  const [mediaForm, setMediaForm] = useState<MediaFormPayload>({
    image_url: "",
    alt_text: "",
    sort_order: "0",
    is_primary: false,
    variant_id: "",
  });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [savingVariant, setSavingVariant] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);
  const [savingVariantId, setSavingVariantId] = useState<number | null>(null);
  const [deletingVariantId, setDeletingVariantId] = useState<number | null>(
    null,
  );
  const [variantDrafts, setVariantDrafts] = useState<
    Record<number, VariantDraft>
  >({});
  const [savingMediaId, setSavingMediaId] = useState<number | null>(null);
  const [deletingMediaId, setDeletingMediaId] = useState<number | null>(null);
  const [mediaDrafts, setMediaDrafts] = useState<Record<number, MediaDraft>>(
    {},
  );
  const [pendingDeleteAction, setPendingDeleteAction] =
    useState<PendingDeleteAction | null>(null);
  const cancelDeleteButtonRef = useRef<HTMLButtonElement | null>(null);

  const title = useMemo(
    () => (isEditMode ? "Edit Product" : "Add Product"),
    [isEditMode],
  );

  const loadForm = useCallback(async () => {
    setLoading(true);
    setFormLoadError(null);

    try {
      const categoriesResponse = await api.get("/products/categories/");
      const categoryItems =
        categoriesResponse.data.results || categoriesResponse.data;
      setCategories(categoryItems);

      if (isEditMode && id) {
        const productResponse = await api.get(`/products/products/${id}/`);
        const product = productResponse.data;
        setForm({
          category_id: String(product.category?.id || ""),
          name: product.name || "",
          slug: product.slug || "",
          description: product.description || "",
          price: String(product.price || ""),
          stock: String(product.stock ?? 0),
          is_active: Boolean(product.is_active),
        });
        setVariants(Array.isArray(product.variants) ? product.variants : []);
        setMediaItems(Array.isArray(product.media) ? product.media : []);
        return;
      }

      setForm(EMPTY_FORM);
      setVariants([]);
      setMediaItems([]);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Failed to load product form");
      setFormLoadError(message);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [id, isEditMode]);

  const refreshProductAssets = useCallback(async () => {
    if (!id) {
      return;
    }

    const refreshed = await api.get(`/products/products/${id}/`);
    setMediaItems(
      Array.isArray(refreshed.data?.media) ? refreshed.data.media : [],
    );
    setVariants(
      Array.isArray(refreshed.data?.variants) ? refreshed.data.variants : [],
    );
  }, [id]);

  useEffect(() => {
    void loadForm();
  }, [loadForm]);

  useEffect(() => {
    setVariantDrafts(
      Object.fromEntries(
        variants.map((variant) => [
          variant.id,
          {
            color: variant.color || "",
            size: variant.size || "",
            sku: variant.sku || "",
            stock_override: String(
              variant.stock_override ?? variant.stock ?? "",
            ),
          },
        ]),
      ),
    );
  }, [variants]);

  useEffect(() => {
    setMediaDrafts(
      Object.fromEntries(
        mediaItems.map((media) => [
          media.id,
          {
            image_url: media.url || "",
            alt_text: media.alt_text || "",
            sort_order: String(media.sort_order ?? 0),
            is_primary: Boolean(media.is_primary),
            variant_id: media.variant_id ? String(media.variant_id) : "",
          },
        ]),
      ),
    );
  }, [mediaItems]);

  useEffect(() => {
    if (!pendingDeleteAction) {
      return;
    }

    cancelDeleteButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPendingDeleteAction(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pendingDeleteAction]);

  const onSubmit = async () => {
    if (
      !form.category_id ||
      !form.name.trim() ||
      !form.slug.trim() ||
      !form.price.trim()
    ) {
      showError("Category, name, slug, and price are required");
      return;
    }

    setSaving(true);

    const payload = {
      category_id: Number(form.category_id),
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      price: form.price,
      stock: Number(form.stock || 0),
      is_active: form.is_active,
    };

    try {
      if (isEditMode && id) {
        await api.patch(`/products/products/${id}/`, payload);
        showSuccess("Product updated successfully");
      } else {
        await api.post("/products/products/", payload);
        showSuccess("Product created successfully");
      }
      navigate("/admin");
    } catch (error: unknown) {
      const data = getErrorData(error);
      const slugError = getErrorFieldMessages(error, "slug")[0];
      const nameError = getErrorFieldMessages(error, "name")[0];
      showError(
        (typeof data?.detail === "string" && data.detail) ||
          slugError ||
          nameError ||
          "Failed to save product",
      );
    } finally {
      setSaving(false);
    }
  };

  const createVariant = async () => {
    if (!id) {
      return;
    }

    setSavingVariant(true);
    try {
      const payload = {
        color: variantForm.color.trim(),
        size: variantForm.size.trim(),
        sku: variantForm.sku.trim(),
        stock_override: variantForm.stock_override.trim()
          ? Number(variantForm.stock_override)
          : null,
      };
      const response = await api.post(`/products/${id}/variants/`, payload);
      setVariants((current) => [...current, response.data]);
      await refreshProductAssets();
      setVariantForm({ color: "", size: "", sku: "", stock_override: "" });
      showSuccess("Variant added.");
    } catch (error: unknown) {
      showError(getErrorMessage(error, "Failed to add variant."));
    } finally {
      setSavingVariant(false);
    }
  };

  const uploadMedia = async () => {
    if (!id) {
      return;
    }

    if (!mediaForm.image_url.trim() && !mediaFile) {
      showError("Provide image URL or choose a file.");
      return;
    }

    setSavingMedia(true);
    try {
      const payload = new FormData();
      if (mediaForm.image_url.trim()) {
        payload.append("image_url", mediaForm.image_url.trim());
      }
      if (mediaFile) {
        payload.append("image_file", mediaFile);
      }
      payload.append("alt_text", mediaForm.alt_text.trim());
      payload.append("sort_order", String(Number(mediaForm.sort_order || 0)));
      payload.append("is_primary", String(mediaForm.is_primary));
      if (mediaForm.variant_id) {
        payload.append("variant_id", mediaForm.variant_id);
      }

      await api.post(`/products/${id}/media/`, payload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      await refreshProductAssets();

      setMediaForm({
        image_url: "",
        alt_text: "",
        sort_order: "0",
        is_primary: false,
        variant_id: "",
      });
      setMediaFile(null);
      showSuccess("Media uploaded.");
    } catch (error: unknown) {
      showError(getErrorMessage(error, "Failed to upload media."));
    } finally {
      setSavingMedia(false);
    }
  };

  const updateVariant = async (variantId: number) => {
    if (!id) {
      return;
    }

    const draft = variantDrafts[variantId];
    if (!draft) {
      return;
    }

    setSavingVariantId(variantId);
    try {
      await api.patch(`/products/${id}/variants/${variantId}/`, {
        color: draft.color.trim(),
        size: draft.size.trim(),
        sku: draft.sku.trim(),
        stock_override: draft.stock_override.trim()
          ? Number(draft.stock_override)
          : null,
      });
      await refreshProductAssets();
      showSuccess("Variant updated.");
    } catch (error: unknown) {
      showError(getErrorMessage(error, "Failed to update variant."));
    } finally {
      setSavingVariantId(null);
    }
  };

  const executeVariantDelete = async (variantId: number) => {
    if (!id) {
      return;
    }

    setDeletingVariantId(variantId);
    try {
      await api.delete(`/products/${id}/variants/${variantId}/`);
      await refreshProductAssets();
      setVariantDrafts((current) => {
        const next = { ...current };
        delete next[variantId];
        return next;
      });
      showSuccess("Variant deleted.");
    } catch (error: unknown) {
      showError(getErrorMessage(error, "Failed to delete variant."));
    } finally {
      setDeletingVariantId(null);
    }
  };

  const deleteVariant = (variantId: number) => {
    setPendingDeleteAction({
      type: "variant",
      id: variantId,
      title: "Delete variant",
      message: "This will remove the variant and media linked to it.",
    });
  };

  const updateMedia = async (mediaId: number) => {
    if (!id) {
      return;
    }

    const draft = mediaDrafts[mediaId];
    if (!draft) {
      return;
    }

    setSavingMediaId(mediaId);
    try {
      await api.patch(`/products/${id}/media/${mediaId}/`, {
        image_url: draft.image_url.trim(),
        alt_text: draft.alt_text.trim(),
        sort_order: Number(draft.sort_order || 0),
        is_primary: draft.is_primary,
        variant_id: draft.variant_id ? Number(draft.variant_id) : null,
      });
      await refreshProductAssets();
      showSuccess("Media updated.");
    } catch (error: unknown) {
      showError(getErrorMessage(error, "Failed to update media."));
    } finally {
      setSavingMediaId(null);
    }
  };

  const executeMediaDelete = async (mediaId: number) => {
    if (!id) {
      return;
    }

    setDeletingMediaId(mediaId);
    try {
      await api.delete(`/products/${id}/media/${mediaId}/`);
      await refreshProductAssets();
      setMediaDrafts((current) => {
        const next = { ...current };
        delete next[mediaId];
        return next;
      });
      showSuccess("Media deleted.");
    } catch (error: unknown) {
      showError(getErrorMessage(error, "Failed to delete media."));
    } finally {
      setDeletingMediaId(null);
    }
  };

  const deleteMedia = (mediaId: number) => {
    setPendingDeleteAction({
      type: "media",
      id: mediaId,
      title: "Delete media",
      message: "This media item will be permanently removed.",
    });
  };

  const confirmDeleteAction = async () => {
    if (!pendingDeleteAction) {
      return;
    }

    const action = pendingDeleteAction;
    setPendingDeleteAction(null);

    if (action.type === "variant") {
      await executeVariantDelete(action.id);
      return;
    }

    await executeMediaDelete(action.id);
  };

  return (
    <div className="ds-page">
      <header className="ds-page-header">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="ds-page-title">{title}</h1>
          <Link to="/admin">
            <Button variant="outline" size="sm">
              Back to Admin
            </Button>
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8"
      >
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <FlowStateCard
                message="Loading product form..."
                contentClassName="py-8"
              />
            ) : formLoadError ? (
              <FlowStateCard
                title="Unable to load product form"
                message={formLoadError}
                messageClassName="text-rose-600"
                actionLabel="Try Again"
                onAction={() => {
                  void loadForm();
                }}
                contentClassName="py-8"
              />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <select
                      value={form.category_id}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          category_id: event.target.value,
                        }))
                      }
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Price</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.price}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          price: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={form.name}
                      onChange={(event) =>
                        setForm((current) => {
                          const nameValue = event.target.value;
                          return {
                            ...current,
                            name: nameValue,
                            slug: current.slug
                              ? current.slug
                              : toSlug(nameValue),
                          };
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Slug</label>
                    <Input
                      value={form.slug}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          slug: toSlug(event.target.value),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Stock</label>
                    <Input
                      type="number"
                      min={0}
                      value={form.stock}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          stock: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-end pb-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            is_active: event.target.checked,
                          }))
                        }
                      />
                      Active product
                    </label>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      rows={5}
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Link to="/admin">
                    <Button variant="outline" disabled={saving}>
                      Cancel
                    </Button>
                  </Link>
                  <Button onClick={onSubmit} disabled={saving}>
                    {saving
                      ? "Saving..."
                      : isEditMode
                        ? "Save Changes"
                        : "Create Product"}
                  </Button>
                </div>

                {isEditMode && id && (
                  <Card className="mt-6 border-dashed">
                    <CardHeader>
                      <CardTitle>Variants & Media</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Color</label>
                          <Input
                            value={variantForm.color}
                            onChange={(event) =>
                              setVariantForm((current) => ({
                                ...current,
                                color: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Size</label>
                          <Input
                            value={variantForm.size}
                            onChange={(event) =>
                              setVariantForm((current) => ({
                                ...current,
                                size: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">SKU</label>
                          <Input
                            value={variantForm.sku}
                            onChange={(event) =>
                              setVariantForm((current) => ({
                                ...current,
                                sku: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Stock Override
                          </label>
                          <Input
                            type="number"
                            min={0}
                            value={variantForm.stock_override}
                            onChange={(event) =>
                              setVariantForm((current) => ({
                                ...current,
                                stock_override: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          onClick={createVariant}
                          disabled={savingVariant}
                        >
                          {savingVariant ? "Adding..." : "Add Variant"}
                        </Button>
                      </div>

                      <div className="space-y-3 rounded-md border p-3">
                        <p className="text-sm font-semibold">
                          Existing Variants
                        </p>
                        {variants.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No variants yet.
                          </p>
                        ) : (
                          <div className="grid gap-2 md:grid-cols-2">
                            {variants.map((variant) => {
                              const draft = variantDrafts[variant.id] || {
                                color: variant.color || "",
                                size: variant.size || "",
                                sku: variant.sku || "",
                                stock_override: String(
                                  variant.stock_override ?? variant.stock ?? "",
                                ),
                              };

                              return (
                                <div
                                  key={variant.id}
                                  className="space-y-2 rounded-md border p-3 text-sm"
                                >
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <Input
                                      value={draft.color}
                                      onChange={(event) =>
                                        setVariantDrafts((current) => ({
                                          ...current,
                                          [variant.id]: {
                                            ...draft,
                                            color: event.target.value,
                                          },
                                        }))
                                      }
                                      placeholder="Color"
                                    />
                                    <Input
                                      value={draft.size}
                                      onChange={(event) =>
                                        setVariantDrafts((current) => ({
                                          ...current,
                                          [variant.id]: {
                                            ...draft,
                                            size: event.target.value,
                                          },
                                        }))
                                      }
                                      placeholder="Size"
                                    />
                                    <Input
                                      value={draft.sku}
                                      onChange={(event) =>
                                        setVariantDrafts((current) => ({
                                          ...current,
                                          [variant.id]: {
                                            ...draft,
                                            sku: event.target.value,
                                          },
                                        }))
                                      }
                                      placeholder="SKU"
                                    />
                                    <Input
                                      type="number"
                                      min={0}
                                      value={draft.stock_override}
                                      onChange={(event) =>
                                        setVariantDrafts((current) => ({
                                          ...current,
                                          [variant.id]: {
                                            ...draft,
                                            stock_override: event.target.value,
                                          },
                                        }))
                                      }
                                      placeholder="Stock override"
                                    />
                                  </div>

                                  <div className="flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => updateVariant(variant.id)}
                                      disabled={savingVariantId === variant.id}
                                    >
                                      {savingVariantId === variant.id
                                        ? "Saving..."
                                        : "Save"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="bg-red-600 text-white hover:bg-red-700"
                                      onClick={() => deleteVariant(variant.id)}
                                      disabled={
                                        deletingVariantId === variant.id
                                      }
                                    >
                                      {deletingVariantId === variant.id
                                        ? "Deleting..."
                                        : "Delete"}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-medium">
                            Image URL
                          </label>
                          <Input
                            value={mediaForm.image_url}
                            onChange={(event) =>
                              setMediaForm((current) => ({
                                ...current,
                                image_url: event.target.value,
                              }))
                            }
                            placeholder="https://..."
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-medium">
                            Or Upload File
                          </label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              setMediaFile(event.target.files?.[0] || null)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Variant</label>
                          <select
                            value={mediaForm.variant_id}
                            onChange={(event) =>
                              setMediaForm((current) => ({
                                ...current,
                                variant_id: event.target.value,
                              }))
                            }
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          >
                            <option value="">Product default</option>
                            {variants.map((variant) => (
                              <option key={variant.id} value={variant.id}>
                                {variant.color || "Default"}
                                {variant.size ? ` / ${variant.size}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Sort Order
                          </label>
                          <Input
                            type="number"
                            min={0}
                            value={mediaForm.sort_order}
                            onChange={(event) =>
                              setMediaForm((current) => ({
                                ...current,
                                sort_order: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-medium">
                            Alt Text
                          </label>
                          <Input
                            value={mediaForm.alt_text}
                            onChange={(event) =>
                              setMediaForm((current) => ({
                                ...current,
                                alt_text: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-end pb-2 md:col-span-2">
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={mediaForm.is_primary}
                              onChange={(event) =>
                                setMediaForm((current) => ({
                                  ...current,
                                  is_primary: event.target.checked,
                                }))
                              }
                            />
                            Set as primary
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={uploadMedia} disabled={savingMedia}>
                          {savingMedia ? "Uploading..." : "Upload Media"}
                        </Button>
                      </div>

                      <div className="space-y-3 rounded-md border p-3">
                        <p className="text-sm font-semibold">Existing Media</p>
                        {mediaItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No media yet.
                          </p>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {mediaItems.map((media) => {
                              const draft = mediaDrafts[media.id] || {
                                image_url: media.url,
                                alt_text: media.alt_text || "",
                                sort_order: String(media.sort_order ?? 0),
                                is_primary: Boolean(media.is_primary),
                                variant_id: media.variant_id
                                  ? String(media.variant_id)
                                  : "",
                              };

                              return (
                                <div
                                  key={media.id}
                                  className="space-y-2 rounded-md border p-2"
                                >
                                  <img
                                    src={media.url}
                                    alt={media.alt_text || "Product media"}
                                    className="h-28 w-full rounded object-cover"
                                  />

                                  <Input
                                    value={draft.image_url}
                                    onChange={(event) =>
                                      setMediaDrafts((current) => ({
                                        ...current,
                                        [media.id]: {
                                          ...draft,
                                          image_url: event.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="Image URL"
                                  />
                                  <Input
                                    value={draft.alt_text}
                                    onChange={(event) =>
                                      setMediaDrafts((current) => ({
                                        ...current,
                                        [media.id]: {
                                          ...draft,
                                          alt_text: event.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="Alt text"
                                  />
                                  <div className="grid grid-cols-2 gap-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      value={draft.sort_order}
                                      onChange={(event) =>
                                        setMediaDrafts((current) => ({
                                          ...current,
                                          [media.id]: {
                                            ...draft,
                                            sort_order: event.target.value,
                                          },
                                        }))
                                      }
                                      placeholder="Order"
                                    />
                                    <select
                                      value={draft.variant_id}
                                      onChange={(event) =>
                                        setMediaDrafts((current) => ({
                                          ...current,
                                          [media.id]: {
                                            ...draft,
                                            variant_id: event.target.value,
                                          },
                                        }))
                                      }
                                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                    >
                                      <option value="">Default</option>
                                      {variants.map((variant) => (
                                        <option
                                          key={variant.id}
                                          value={variant.id}
                                        >
                                          {variant.color || "Default"}
                                          {variant.size
                                            ? ` / ${variant.size}`
                                            : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <label className="inline-flex items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={draft.is_primary}
                                      onChange={(event) =>
                                        setMediaDrafts((current) => ({
                                          ...current,
                                          [media.id]: {
                                            ...draft,
                                            is_primary: event.target.checked,
                                          },
                                        }))
                                      }
                                    />
                                    Primary
                                  </label>

                                  <div className="flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => updateMedia(media.id)}
                                      disabled={savingMediaId === media.id}
                                    >
                                      {savingMediaId === media.id
                                        ? "Saving..."
                                        : "Save"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="bg-red-600 text-white hover:bg-red-700"
                                      onClick={() => deleteMedia(media.id)}
                                      disabled={deletingMediaId === media.id}
                                    >
                                      {deletingMediaId === media.id
                                        ? "Deleting..."
                                        : "Delete"}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {pendingDeleteAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          aria-describedby="delete-confirm-message"
        >
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle id="delete-confirm-title">
                {pendingDeleteAction.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p
                id="delete-confirm-message"
                className="text-sm text-muted-foreground"
              >
                {pendingDeleteAction.message}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  ref={cancelDeleteButtonRef}
                  variant="outline"
                  onClick={() => setPendingDeleteAction(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={confirmDeleteAction}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
