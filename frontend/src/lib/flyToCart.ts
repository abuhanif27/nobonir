export function animateFlyToCart(options: {
  fromElement?: HTMLElement | null;
  toSelector?: string;
  imageSrc?: string;
}) {
  const {
    fromElement,
    toSelector = '[data-cart-nav="true"]',
    imageSrc,
  } = options;

  if (!fromElement || typeof window === "undefined") {
    return;
  }

  const toElement = document.querySelector(toSelector) as HTMLElement | null;
  if (!toElement) {
    return;
  }

  const fromRect = fromElement.getBoundingClientRect();
  const toRect = toElement.getBoundingClientRect();

  const flyer = document.createElement("div");
  flyer.style.position = "fixed";
  flyer.style.left = `${fromRect.left + fromRect.width / 2 - 18}px`;
  flyer.style.top = `${fromRect.top + fromRect.height / 2 - 18}px`;
  flyer.style.width = "36px";
  flyer.style.height = "36px";
  flyer.style.borderRadius = "9999px";
  flyer.style.zIndex = "9999";
  flyer.style.pointerEvents = "none";
  flyer.style.boxShadow = "0 10px 24px rgba(0, 0, 0, 0.25)";
  flyer.style.overflow = "hidden";

  if (imageSrc) {
    flyer.style.backgroundImage = `url(${imageSrc})`;
    flyer.style.backgroundSize = "cover";
    flyer.style.backgroundPosition = "center";
  } else {
    flyer.style.background = "linear-gradient(135deg, #14b8a6, #2563eb)";
  }

  document.body.appendChild(flyer);

  const deltaX =
    toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2);
  const deltaY =
    toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2);

  const animation = flyer.animate(
    [
      {
        transform: "translate(0px, 0px) scale(1) rotate(0deg)",
        opacity: 1,
      },
      {
        transform: `translate(${deltaX * 0.5}px, ${deltaY * 0.5 - 36}px) scale(0.75) rotate(8deg)`,
        opacity: 0.95,
      },
      {
        transform: `translate(${deltaX}px, ${deltaY}px) scale(0.2) rotate(16deg)`,
        opacity: 0.2,
      },
    ],
    {
      duration: 700,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    },
  );

  toElement.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.12)" },
      { transform: "scale(1)" },
    ],
    {
      duration: 320,
      easing: "ease-out",
    },
  );

  animation.onfinish = () => {
    flyer.remove();
  };
}
