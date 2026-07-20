export const SUPPORT_EMAIL = "contact@reshareloop.com";

export const OUT_OF_SCOPE_REPLY =
  "I can only help with ReShareLoop shopping, renting, selling, returns, orders, and account questions.";

export const PLATFORM_KEYWORDS = [
  "reshareloop",
  "rent",
  "renting",
  "rental",
  "return",
  "returning",
  "refund",
  "exchange",
  "order",
  "seller",
  "buyer",
  "cart",
  "checkout",
  "place order",
  "shipping",
  "delivery",
  "tracking",
  "product",
  "store",
  "payment",
  "deposit",
  "lend",
  "lending",
  "sell",
  "selling",
  "buy",
  "buying",
  "list",
  "listing",
  "account",
  "login",
  "sign in",
  "password",
  "custom",
  "customization",
  "personalized",
  "inventory",
  "stock",
  "wanted",
  "service",
  "support",
  "租",
  "租赁",
  "退货",
  "退款",
  "订单",
  "卖家",
  "买家",
  "购物车",
  "结账",
  "下单",
  "配送",
  "物流",
  "追踪",
  "商品",
  "店铺",
  "付款",
  "押金",
  "账户",
  "登录",
  "密码",
  "定制",
  "个性化",
  "库存",
  "求购",
  "服务",
  "客服",
];

export const PRODUCT_CONTEXT_KEYWORDS = [
  "this",
  "this item",
  "this product",
  "item",
  "price",
  "size",
  "stock",
  "available",
  "availability",
  "seller",
  "store",
  "rent",
  "renting",
  "rental",
  "lending",
  "buy",
  "buying",
  "cart",
  "checkout",
  "description",
  "condition",
  "custom",
  "customization",
  "这个",
  "这件",
  "这个商品",
  "商品",
  "价格",
  "尺码",
  "库存",
  "有货",
  "可租",
  "卖家",
  "店铺",
  "租",
  "购买",
  "购物车",
  "描述",
  "成色",
  "定制",
];

export const KNOWLEDGE_FACTS = [
  "ReShareLoop lets users buy, rent, lend, sell unused items, and offer services.",
  "Buyers can browse products, add items to cart, place orders, and manage orders from the Orders page.",
  "Sellers and lenders use the seller center to list sale items, list lendable items, manage inventory, manage orders, update banners, and edit their store profile.",
  "Eligible purchase returns are accepted within 30 days of delivery.",
  "New unused return items must be unused, unworn, in original packaging, and include proof of purchase.",
  "Clearance, personalized, or final-sale products may not be returnable.",
  "Buyers pay return shipping unless the item is defective or incorrect.",
  "Approved refunds go back to the original payment method within 5-10 business days.",
  "Defective or incorrect items should be reported within 7 days of delivery.",
  "AI answers should not be treated as live order, inventory, payment, refund, or account status.",
  "Private account and order-specific issues should be handled through the user's account pages or ReShareLoop support.",
];

export const FAQ_ENTRIES = [
  {
    id: "platform-overview",
    keywords: ["what is reshareloop", "about reshareloop", "how does reshareloop work", "平台", "是什么"],
    answer:
      "ReShareLoop is a marketplace where users can buy, rent, lend, sell unused items, and offer services. Buyers use the storefront to browse and order, while sellers and lenders manage listings from the seller center.",
  },
  {
    id: "return-policy",
    keywords: ["return", "refund", "exchange", "退货", "退款", "换货"],
    answer:
      "Eligible purchase returns are accepted within 30 days of delivery. Items must be unused, unworn, in original packaging, and include proof of purchase. Clearance, personalized, or final-sale products may not be returnable.",
  },
  {
    id: "return-shipping",
    keywords: ["return shipping", "shipping cost", "return cost", "退货运费", "运费谁付"],
    answer:
      "Buyers are responsible for return shipping unless the item received is defective or incorrect. Original shipping costs are generally non-refundable.",
  },
  {
    id: "final-sale-customized",
    keywords: ["final sale", "clearance", "personalized", "customized", "customization", "定制", "个性化", "清仓", "不可退"],
    answer:
      "Clearance, personalized, customized, or final-sale products may not be returnable. Check the item details before placing the order.",
  },
  {
    id: "damaged-incorrect-item",
    keywords: ["damaged", "incorrect", "wrong item", "defective", "损坏", "发错", "有问题"],
    answer: `If you receive a defective or incorrect item, contact ${SUPPORT_EMAIL} within 7 days of delivery. ReShareLoop will cover return shipping for eligible replacements.`,
  },
  {
    id: "refund-timeline",
    keywords: ["refund timeline", "when refund", "5-10", "退款多久", "多久到账"],
    answer:
      "Approved refunds are issued to the original payment method within 5-10 business days after the return is reviewed and approved.",
  },
  {
    id: "seller-start",
    keywords: ["seller", "sell", "selling", "list", "listing", "list item", "become a seller", "卖家", "出售", "上架"],
    answer:
      "To sell on ReShareLoop, sign in to the seller center, then use the dashboard to add sale items, lendable items, inventory details, and your store profile.",
  },
  {
    id: "seller-dashboard",
    keywords: ["seller center", "seller dashboard", "admin portal", "manage listing", "manage inventory", "后台", "卖家中心", "管理商品", "管理库存"],
    answer:
      "Sellers use the seller center to add sale items, add lendable items, manage product lists, inventory, orders, banners, and store profile details.",
  },
  {
    id: "store-profile",
    keywords: ["store profile", "edit store", "seller profile", "店铺资料", "店铺介绍"],
    answer:
      "Sellers can update their store profile from the seller center. Store information helps buyers understand who they are buying or renting from.",
  },
  {
    id: "renting",
    keywords: ["how does renting work", "rent", "renting", "rental", "lend", "lending", "deposit", "租", "租赁", "出租", "押金"],
    answer:
      "Renting on ReShareLoop works like this:\n\n1. Open a rentable item and review its details, price, availability, and rental terms.\n2. Select your rental dates on the product page.\n3. Add the item to your cart and complete checkout.\n4. If a deposit or hold applies, the amount and handling will be shown during checkout.\n5. After checkout, track rental details from your Orders page.\n\nFor item-specific availability, deposit, return, or pickup/shipping details, rely on the product page, order details, or contact ReShareLoop support.",
  },
  {
    id: "rental-dates",
    keywords: ["rental dates", "rent dates", "calendar", "availability", "租期", "日期", "日历", "可租"],
    answer:
      "For rentable products, choose the available rental dates on the product page before adding the item to your cart. Availability and pricing depend on the listing.",
  },
  {
    id: "deposit",
    keywords: ["deposit", "hold", "security deposit", "押金", "预授权"],
    answer:
      "Some rentals may include deposit handling. Deposit details depend on the rental item and checkout flow. For private deposit questions, check your order details or contact support.",
  },
  {
    id: "orders",
    keywords: ["order", "orders page", "track order", "订单", "查看订单", "追踪"],
    answer:
      "You can review your purchases and rentals from the Orders page. For private order-specific issues, use the order details in your account or contact ReShareLoop support.",
  },
  {
    id: "order-status-privacy",
    keywords: ["where is my order", "order status", "live order", "payment status", "我的订单在哪", "订单状态", "支付状态"],
    answer:
      "For live order or payment status, check the Orders page in your account. I cannot verify private live order, payment, or refund status from chat.",
  },
  {
    id: "cart-checkout",
    keywords: ["cart", "checkout", "place order", "add to cart", "购物车", "结账", "下单", "加入购物车"],
    answer:
      "Add the item to your cart from the product page, review your cart, then continue to checkout to place the order. Product options such as size, rental dates, or customization should be selected before checkout.",
  },
  {
    id: "shipping-tracking",
    keywords: ["shipping", "delivery", "tracking", "ship", "配送", "物流", "快递", "追踪"],
    answer:
      "Shipping and tracking details depend on the seller and order status. Check your Orders page for available tracking information. For missing or unclear tracking, contact support.",
  },
  {
    id: "payment",
    keywords: ["payment", "pay", "stripe", "google pay", "付款", "支付", "信用卡"],
    answer:
      "Payment options are handled during checkout. I cannot verify private payment status from chat; check the order or payment result shown in your account.",
  },
  {
    id: "account-login",
    keywords: ["login", "sign in", "account", "password", "reset password", "登录", "账户", "密码", "重置密码"],
    answer:
      "Use the login page to sign in. If you cannot access your account, use the reset password flow from the login or reset password page.",
  },
  {
    id: "product-stock",
    keywords: ["stock", "inventory", "available", "out of stock", "库存", "有货", "缺货"],
    answer:
      "Product availability is shown on the product page. Because inventory can change, rely on the current product page and checkout result for the latest availability.",
  },
  {
    id: "wanted-items",
    keywords: ["wanted item", "wanted items", "request item", "求购", "想要", "需求"],
    answer:
      "Use the Wanted Items page to browse or submit item requests. This helps the marketplace understand what buyers are looking for.",
  },
  {
    id: "services",
    keywords: ["service", "offer service", "skills", "服务", "技能"],
    answer:
      "ReShareLoop can support service offerings such as tutoring, design, repair, or pet sitting. Service details depend on each listing or seller profile.",
  },
  {
    id: "support",
    keywords: ["support", "contact", "help", "客服", "联系", "帮助"],
    answer: `For account, payment, or order-specific help, contact ReShareLoop support at ${SUPPORT_EMAIL}.`,
  },
];
