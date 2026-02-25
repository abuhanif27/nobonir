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
  const fromCenterX = fromRect.left + fromRect.width / 2;
  const fromCenterY = fromRect.top + fromRect.height / 2;
  const toCenterX = toRect.left + toRect.width / 2;
  const toCenterY = toRect.top + toRect.height / 2;

  const flyer = document.createElement("div");
  flyer.style.position = "fixed";
  flyer.style.left = `${fromCenterX - 18}px`;
  flyer.style.top = `${fromCenterY - 18}px`;
  flyer.style.width = "36px";
  flyer.style.height = "36px";
  flyer.style.borderRadius = "9999px";
  flyer.style.zIndex = "9999";
  flyer.style.pointerEvents = "none";
  flyer.style.boxShadow = "0 12px 30px rgba(0, 0, 0, 0.28)";
  flyer.style.overflow = "hidden";

  if (imageSrc) {
    flyer.style.backgroundImage = `url(${imageSrc})`;
    flyer.style.backgroundSize = "cover";
    flyer.style.backgroundPosition = "center";
  } else {
    flyer.style.background = "linear-gradient(135deg, #14b8a6, #2563eb)";
  }

  document.body.appendChild(flyer);

  const trail = document.createElement("div");
  trail.style.position = "fixed";
  trail.style.left = `${fromCenterX - 12}px`;
  trail.style.top = `${fromCenterY - 12}px`;
  trail.style.width = "24px";
  trail.style.height = "24px";
  trail.style.borderRadius = "9999px";
  trail.style.zIndex = "9998";
  trail.style.pointerEvents = "none";
  trail.style.background =
    "radial-gradient(circle, rgba(45,212,191,0.85) 0%, rgba(59,130,246,0.4) 55%, rgba(59,130,246,0) 72%)";
  document.body.appendChild(trail);

  const deltaX = toCenterX - fromCenterX;
  const deltaY = toCenterY - fromCenterY;

  const animation = flyer.animate(
    [
      {
        transform: "translate(0px, 0px) scale(1) rotate(0deg)",
        opacity: 1,
      },
      {
        transform: `translate(${deltaX * 0.35}px, ${deltaY * 0.35 - 52}px) scale(0.85) rotate(14deg)`,
        opacity: 0.95,
      },
      {
        transform: `translate(${deltaX * 0.7}px, ${deltaY * 0.7 - 18}px) scale(0.62) rotate(28deg)`,
        opacity: 0.85,
      },
      {
        transform: `translate(${deltaX}px, ${deltaY}px) scale(0.22) rotate(40deg)`,
        opacity: 0.12,
      },
    ],
    {
      duration: 820,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    },
  );

  trail.animate(
    [
      {
        transform: "translate(0px, 0px) scale(1)",
        opacity: 0.9,
      },
      {
        transform: `translate(${deltaX * 0.55}px, ${deltaY * 0.55 - 26}px) scale(0.7)`,
        opacity: 0.45,
      },
      {
        transform: `translate(${deltaX}px, ${deltaY}px) scale(0.25)`,
        opacity: 0,
      },
    ],
    {
      duration: 820,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    },
  );

  const impactRing = document.createElement("div");
  impactRing.style.position = "fixed";
  impactRing.style.left = `${toCenterX - 8}px`;
  impactRing.style.top = `${toCenterY - 8}px`;
  impactRing.style.width = "16px";
  impactRing.style.height = "16px";
  impactRing.style.borderRadius = "9999px";
  impactRing.style.border = "2px solid rgba(20,184,166,0.8)";
  impactRing.style.zIndex = "9997";
  impactRing.style.pointerEvents = "none";
  impactRing.style.opacity = "0";
  document.body.appendChild(impactRing);

  toElement.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.15)" },
      { transform: "scale(0.96)" },
      { transform: "scale(1)" },
    ],
    {
      duration: 420,
      easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    },
  );

  const impactAnimation = impactRing.animate(
    [
      { transform: "scale(0.4)", opacity: 0 },
      { transform: "scale(1)", opacity: 0.75 },
      { transform: "scale(2.2)", opacity: 0 },
    ],
    {
      duration: 460,
      delay: 360,
      easing: "ease-out",
      fill: "forwards",
    },
  );

  animation.onfinish = () => {
    flyer.remove();
    trail.remove();
  };

  impactAnimation.onfinish = () => {
    impactRing.remove();
  };
}
