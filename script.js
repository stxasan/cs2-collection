"use strict";

const API_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins_not_grouped.json";

const STORAGE_KEY = "cs2-owned";

// Supabase: публичный ключ можно размещать в браузере.
// Защита изменений обеспечивается RLS-политиками в базе данных.
const SUPABASE_URL = "https://qmidhtgbllrsezwvvkev.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xm5rQgBjwLMTMMSSed_L-A_A5jt4FFD";
const OWNER_UID = "8a12b204-53be-44be-9459-25460b330162";
const COLLECTION_ROW_ID = "main";

const categories = [
  "Все",
  "Ширпотреб",
  "Промышленное",
  "Армейское",
  "Запрещённое",
  "Засекреченное",
  "Тайное",
  "Сувенир",
  "StatTrak™"
];

const rarityCategories = [
  "Ширпотреб",
  "Промышленное",
  "Армейское",
  "Запрещённое",
  "Засекреченное",
  "Тайное"
];

const rarityMap = {
  "Consumer Grade": "Ширпотреб",
  "Industrial Grade": "Промышленное",
  "Mil-Spec Grade": "Армейское",
  "Restricted": "Запрещённое",
  "Classified": "Засекреченное",
  "Covert": "Тайное"
};

const weaponCategories = [
  "Все оружие",
  "Ножи",
  "Пистолеты",
  "ПП",
  "Штурмовые винтовки",
  "Снайперские винтовки",
  "Дробовики",
  "Пулемёты"
];

const weaponCategoryMap = {
  knives: "Ножи",
  knife: "Ножи",
  pistols: "Пистолеты",
  pistol: "Пистолеты",
  smgs: "ПП",
  smg: "ПП",
  "submachine guns": "ПП",
  rifles: "Штурмовые винтовки",
  "sniper rifles": "Снайперские винтовки",
  "sniper rifle": "Снайперские винтовки",
  shotguns: "Дробовики",
  machineguns: "Пулемёты",
  "machine guns": "Пулемёты"
};

const elements = {
  grid: document.getElementById("skin-grid"),
  tabs: document.getElementById("category-tabs"),
  weaponTabs: document.getElementById("weapon-tabs"),
  search: document.getElementById("search"),
  ownedOnly: document.getElementById("owned-only"),
  emptyMessage: document.getElementById("empty-message"),
  ownedCount: document.getElementById("owned-count"),
  totalCount: document.getElementById("total-count"),
  progress: document.getElementById("progress"),
  progressBar: document.getElementById("progress-bar"),
  selectAll: document.getElementById("select-all-skins"),
  deselectAll: document.getElementById("deselect-all-skins"),
  categoryStats: document.getElementById("category-stats"),
  backToTop: document.getElementById("back-to-top")
};

let skins = [];
let activeCategory = "Все";
let activeWeapon = "Все оружие";

// Сохраняем старые локальные отметки для возможного переноса в облако.
// После загрузки страницы источник истины — Supabase.
const localOwnedForMigration = loadSavedOwned();
let owned = [];
let supabaseClient = null;
let currentUser = null;
let isOwner = false;
let cloudCollectionLoaded = false;
let cloudSaveQueue = Promise.resolve();
let ownerPanelElements = null;

/* Загрузка сохранённой коллекции */

function loadSavedOwned() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    if (!Array.isArray(saved)) {
      return [];
    }

    return [...new Set(
      saved.filter(id => typeof id === "string")
    )];
  } catch (error) {
    console.warn("Не удалось прочитать коллекцию:", error);
    return [];
  }
}

/* Определение категории оружия */

function getWeaponCategory(skin) {
  const categoryName = (skin.category?.name || "")
    .trim()
    .toLowerCase();

  const weaponName = (skin.weapon?.name || "")
    .trim()
    .toLowerCase()
    .replace(/™/g, "")
    .replace(/\s+/g, " ");

  const sniperNames = [
    "awp",
    "g3sg1",
    "scar-20",
    "ssg 08",
    "ssg-08"
  ];

  if (sniperNames.includes(weaponName)) {
    return "Снайперские винтовки";
  }

  if (weaponCategoryMap[categoryName]) {
    return weaponCategoryMap[categoryName];
  }

  const weaponGroups = {
    "Ножи": [
      "bayonet",
      "karambit",
      "butterfly knife",
      "m9 bayonet",
      "flip knife",
      "gut knife",
      "huntsman knife",
      "falchion knife",
      "bowie knife",
      "shadow daggers",
      "ursus knife",
      "navaja knife",
      "stiletto knife",
      "talon knife",
      "classic knife",
      "paracord knife",
      "survival knife",
      "nomad knife",
      "skeleton knife",
      "kukri knife"
    ],
    "Пистолеты": [
      "glock-18",
      "usp-s",
      "p2000",
      "p250",
      "five-seven",
      "tec-9",
      "cz75-auto",
      "dual berettas",
      "desert eagle",
      "r8 revolver",
      "zeus x27"
    ],
    "ПП": [
      "mac-10",
      "mp9",
      "mp7",
      "mp5-sd",
      "ump-45",
      "p90",
      "pp-bizon"
    ],
    "Дробовики": [
      "nova",
      "xm1014",
      "mag-7",
      "sawed-off"
    ],
    "Пулемёты": [
      "m249",
      "negev"
    ],
    "Штурмовые винтовки": [
      "ak-47",
      "m4a4",
      "m4a1-s",
      "famas",
      "galil ar",
      "aug",
      "sg 553"
    ]
  };

  if (
    weaponName.includes("knife") ||
    weaponName.includes("daggers") ||
    weaponGroups["Ножи"].some(name =>
      weaponName.includes(name)
    )
  ) {
    return "Ножи";
  }

  for (const [category, names] of Object.entries(weaponGroups)) {
    if (names.includes(weaponName)) {
      return category;
    }
  }

  return "Неизвестное оружие";
}

/* Вкладки типов оружия */

function renderWeaponTabs() {
  elements.weaponTabs.innerHTML = weaponCategories
    .map(category => `
      <button
        type="button"
        class="tab ${activeWeapon === category ? "active" : ""}"
        data-weapon-category="${category}"
        aria-pressed="${activeWeapon === category}"
      >${category}</button>
    `)
    .join("");
}

elements.weaponTabs.addEventListener("click", event => {
  const button = event.target.closest("[data-weapon-category]");

  if (!button) return;

  activeWeapon = button.dataset.weaponCategory;

  renderWeaponTabs();
  renderSkins();
});

/* Вкладки редкости */

function renderTabs() {
  elements.tabs.innerHTML = categories
    .map(category => `
      <button
        type="button"
        class="tab ${activeCategory === category ? "active" : ""}"
        data-category="${category}"
        aria-pressed="${activeCategory === category}"
      >${category}</button>
    `)
    .join("");
}

elements.tabs.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");

  if (!button) return;

  activeCategory = button.dataset.category;

  renderTabs();
  renderSkins();
});

/* Проверка принадлежности к категории */

function matchesCategory(skin) {
  if (activeCategory === "Все") {
    return true;
  }

  if (activeCategory === "Сувенир") {
    return skin.isSouvenir;
  }

  if (activeCategory === "StatTrak™") {
    return skin.isStatTrak;
  }

  return (
    rarityCategories.includes(activeCategory) &&
    skin.rarity === activeCategory &&
    !skin.isSouvenir &&
    !skin.isStatTrak
  );
}

/* Получение отфильтрованных скинов */

function getFilteredSkins(options = {}) {
  const {
    ignoreOwnedOnly = false
  } = options;

  const query = elements.search.value
    .trim()
    .toLowerCase();

  return skins.filter(skin => {
    const matchesRarity = matchesCategory(skin);

    const matchesWeapon =
      activeWeapon === "Все оружие" ||
      skin.weaponCategory === activeWeapon;

    const matchesSearch =
      skin.name.toLowerCase().includes(query) ||
      skin.weaponName.toLowerCase().includes(query);

    const matchesOwned =
      ignoreOwnedOnly ||
      !elements.ownedOnly.checked ||
      owned.includes(skin.id);

    return (
      matchesRarity &&
      matchesWeapon &&
      matchesSearch &&
      matchesOwned
    );
  });
}

/* Общая статистика */

function renderOverallStats() {
  const ownedSet = new Set(owned);

  const count = skins.filter(skin =>
    ownedSet.has(skin.id)
  ).length;

  const total = skins.length;

  const percent = total
    ? Math.round((count / total) * 100)
    : 0;

  elements.ownedCount.textContent = count;
  elements.totalCount.textContent = total;
  elements.progress.textContent = `${percent}%`;
  elements.progressBar.style.width = `${percent}%`;
}

/* Статистика по редкости */

function renderCategoryStats() {
  const ownedSet = new Set(owned);

  elements.categoryStats.innerHTML = rarityCategories
    .map(category => {
      const categorySkins = skins.filter(skin =>
        skin.rarity === category &&
        !skin.isSouvenir &&
        !skin.isStatTrak
      );

      const collected = categorySkins.filter(skin =>
        ownedSet.has(skin.id)
      ).length;

      const total = categorySkins.length;

      const percent = total
        ? Math.round((collected / total) * 100)
        : 0;

      return `
        <div class="category-stat">
          <h3>${category}</h3>
          <strong>${collected} / ${total}</strong>
          <p>Собрано ${percent}%</p>
          <div class="category-stat-track">
            <div style="width: ${percent}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

/* Создание карточки скина */

function createSkinCard(skin) {
  const card = document.createElement("article");
  card.className = "skin-card";

  const art = document.createElement("div");
  art.className = "skin-art";

  const image = document.createElement("img");
  image.src = skin.image;
  image.alt = skin.name;
  image.loading = "lazy";
  image.decoding = "async";

  image.addEventListener("error", () => {
    image.style.display = "none";
  }, { once: true });

  art.appendChild(image);

  const info = document.createElement("div");
  info.className = "skin-info";

  const rarity = document.createElement("div");
  rarity.className = "rarity";
  rarity.textContent = skin.rarity;

  const name = document.createElement("h3");
  name.textContent = skin.name;

  const weapon = document.createElement("div");
  weapon.className = "rarity";
  weapon.textContent = skin.weaponName;

  const wear = document.createElement("div");
  wear.className = "rarity";
  wear.textContent = "Factory New";

  info.append(rarity, name, weapon, wear);

  if (skin.isSouvenir) {
    const type = document.createElement("div");
    type.className = "skin-type souvenir";
    type.textContent = "Souvenir";
    info.appendChild(type);
  }

  if (skin.isStatTrak) {
    const type = document.createElement("div");
    type.className = "skin-type stattrak";
    type.textContent = "StatTrak™";
    info.appendChild(type);
  }

  const label = document.createElement("label");
  label.className = "owned-label";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.dataset.id = skin.id;
  checkbox.checked = owned.includes(skin.id);
  checkbox.disabled = !isOwner;
  checkbox.setAttribute(
    "aria-label",
    `Отметить ${skin.name} как собранный`
  );

  const labelText = document.createElement("span");
  labelText.textContent = isOwner ? "У меня есть" : "В коллекции";

  label.append(checkbox, labelText);
  info.appendChild(label);

  card.append(art, info);

  return card;
}

/* Отображение каталога */

function renderSkins() {
  const filtered = getFilteredSkins();
  const fragment = document.createDocumentFragment();

  filtered.forEach(skin => {
    fragment.appendChild(createSkinCard(skin));
  });

  elements.grid.replaceChildren(fragment);

  elements.emptyMessage.textContent = filtered.length
    ? ""
    : "Скины не найдены.";

  renderOverallStats();
  renderCategoryStats();
}

/* Сохранение коллекции в браузере и облаке */

function showOwnerMessage(message, isError = false) {
  if (!ownerPanelElements?.message) return;
  ownerPanelElements.message.textContent = message;
  ownerPanelElements.message.classList.toggle("is-error", isError);
}

function updateOwnerInterface() {
  if (!ownerPanelElements) return;

  const loggedIn = Boolean(currentUser);
  const isRecognizedOwner = loggedIn && currentUser.id === OWNER_UID;
  isOwner = isRecognizedOwner;

  ownerPanelElements.loginForm.hidden = isOwner;
  ownerPanelElements.logoutButton.hidden = !loggedIn;
  ownerPanelElements.email.disabled = loggedIn;
  ownerPanelElements.password.disabled = loggedIn;
  ownerPanelElements.loginButton.disabled = loggedIn;

  ownerPanelElements.mode.textContent = isOwner
    ? "Режим владельца: редактирование включено"
    : "Публичный режим: только просмотр";

  ownerPanelElements.mode.classList.toggle("is-owner", isOwner);

  const bulkControls = document.querySelector(".bulk-controls");
  if (bulkControls) bulkControls.hidden = !isOwner;

  if (skins.length) renderSkins();
}

function createOwnerPanel() {
  const catalog = document.querySelector(".catalog");
  if (!catalog) return;

  const panel = document.createElement("section");
  panel.className = "owner-panel";
  panel.innerHTML = `
    <div class="owner-panel-heading">
      <strong>Доступ к коллекции</strong>
      <span id="owner-mode" class="owner-mode">Публичный режим: только просмотр</span>
    </div>
    <form id="owner-login-form" class="owner-login-form">
      <label>
        <span>Email владельца</span>
        <input id="owner-email" type="email" autocomplete="username"
          placeholder="Твой email Supabase" required>
      </label>
      <label>
        <span>Пароль</span>
        <input id="owner-password" type="password" autocomplete="current-password"
          placeholder="Пароль аккаунта" required>
      </label>
      <button id="owner-login-button" type="submit">Войти владельцу</button>
    </form>
    <div class="owner-panel-footer">
      <p id="owner-message" class="owner-message" role="status" aria-live="polite">
        Коллекция загружается из облака...
      </p>
      <button id="owner-logout-button" class="owner-logout-button"
        type="button" hidden>Выйти</button>
    </div>
  `;

  const heading = catalog.querySelector(".catalog-heading");
  if (heading) {
    catalog.insertBefore(panel, heading);
  } else {
    catalog.prepend(panel);
  }

  const style = document.createElement("style");
  style.textContent = `
    .owner-panel {
      margin: 0 0 24px;
      padding: 16px;
      border: 1px solid rgba(212, 175, 91, .25);
      border-radius: 14px;
      background: rgba(10, 15, 24, .78);
    }
    .owner-panel-heading, .owner-panel-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .owner-panel-heading strong { color: #f2f4f8; }
    .owner-mode { color: #aeb7c5; font-size: 12px; }
    .owner-mode.is-owner { color: #d7b86a; }
    .owner-login-form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
      gap: 12px;
      align-items: end;
      margin-top: 14px;
    }
    .owner-login-form label { display: grid; gap: 6px; min-width: 0; }
    .owner-login-form label span { color: #aeb7c5; font-size: 12px; }
    .owner-login-form input {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      padding: 10px 12px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px;
      background: #0b111b;
      color: #f2f4f8;
      font: inherit;
    }
    .owner-login-form button, .owner-logout-button {
      padding: 10px 14px;
      border: 1px solid rgba(215,184,106,.45);
      border-radius: 8px;
      background: rgba(215,184,106,.12);
      color: #f0d58f;
      font: inherit;
      cursor: pointer;
    }
    .owner-login-form button:disabled, .owner-login-form input:disabled {
      opacity: .55;
      cursor: not-allowed;
    }
    .owner-panel-footer { margin-top: 10px; }
    .owner-message { margin: 0; color: #aeb7c5; font-size: 12px; }
    .owner-message.is-error { color: #ff9b9b; }
    .owner-panel [hidden] { display: none !important; }
    .skin-card input[type="checkbox"]:disabled { cursor: default; }
    .skin-card .owned-label { cursor: default; }
    @media (max-width: 760px) {
      .owner-login-form { grid-template-columns: 1fr; }
      .owner-login-form button { width: 100%; }
    }
  `;
  document.head.appendChild(style);

  ownerPanelElements = {
    panel,
    mode: panel.querySelector("#owner-mode"),
    loginForm: panel.querySelector("#owner-login-form"),
    email: panel.querySelector("#owner-email"),
    password: panel.querySelector("#owner-password"),
    loginButton: panel.querySelector("#owner-login-button"),
    logoutButton: panel.querySelector("#owner-logout-button"),
    message: panel.querySelector("#owner-message")
  };

  ownerPanelElements.loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!supabaseClient) {
      showOwnerMessage("Supabase ещё подключается. Попробуй через несколько секунд.", true);
      return;
    }

    const email = ownerPanelElements.email.value.trim();
    const password = ownerPanelElements.password.value;
    ownerPanelElements.loginButton.disabled = true;
    showOwnerMessage("Выполняется вход...");

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    ownerPanelElements.loginButton.disabled = false;

    if (error) {
      showOwnerMessage("Не удалось войти. Проверь email, пароль и настройки подтверждения email.", true);
      console.error("Ошибка входа Supabase:", error.message);
      return;
    }

    currentUser = data.user || data.session?.user || null;
    updateOwnerInterface();

    if (currentUser?.id !== OWNER_UID) {
      await supabaseClient.auth.signOut();
      currentUser = null;
      updateOwnerInterface();
      showOwnerMessage("Этот аккаунт не является владельцем коллекции.", true);
      return;
    }

    await loadCloudCollection({ allowMigration: true });
    showOwnerMessage("Вход выполнен. Изменения будут сохраняться в облаке.");
  });

  ownerPanelElements.logoutButton.addEventListener("click", async () => {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      showOwnerMessage("Не удалось выйти из аккаунта.", true);
      return;
    }
    currentUser = null;
    updateOwnerInterface();
    showOwnerMessage("Вы вышли. Коллекция доступна только для просмотра.");
  });
}

function loadSupabaseLibrary() {
  return new Promise((resolve, reject) => {
    if (window.supabase?.createClient) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.async = true;
    script.onload = () => window.supabase?.createClient
      ? resolve()
      : reject(new Error("Библиотека Supabase не загрузилась."));
    script.onerror = () => reject(new Error("Не удалось загрузить библиотеку Supabase."));
    document.head.appendChild(script);
  });
}

async function initializeSupabase() {
  try {
    await loadSupabaseLibrary();
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    currentUser = data.session?.user || null;

    if (currentUser && currentUser.id !== OWNER_UID) {
      await supabaseClient.auth.signOut();
      currentUser = null;
    }

    updateOwnerInterface();
    await loadCloudCollection({ allowMigration: isOwner });

    supabaseClient.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;
      updateOwnerInterface();

      // Вызываем запросы Supabase вне callback auth, чтобы не блокировать его.
      if (event !== "INITIAL_SESSION") {
        window.setTimeout(async () => {
          if (currentUser && currentUser.id !== OWNER_UID) {
            await supabaseClient.auth.signOut();
            currentUser = null;
            updateOwnerInterface();
            showOwnerMessage("Этот аккаунт не имеет права редактировать коллекцию.", true);
            return;
          }
          await loadCloudCollection({ allowMigration: isOwner });
        }, 0);
      }
    });
  } catch (error) {
    console.error("Ошибка подключения Supabase:", error);
    showOwnerMessage(
      "Не удалось подключиться к облаку. Проверь URL, Publishable key и доступ таблицы через Data API.",
      true
    );
  }
}

async function loadCloudCollection({ allowMigration = false } = {}) {
  if (!supabaseClient) return;

  showOwnerMessage("Загружаем коллекцию из облака...");

  const { data, error } = await supabaseClient
    .from("collection_state")
    .select("owned_ids")
    .eq("id", COLLECTION_ROW_ID)
    .maybeSingle();

  if (error) {
    console.error("Ошибка загрузки коллекции из Supabase:", error);
    cloudCollectionLoaded = false;
    showOwnerMessage(
      "Не удалось загрузить коллекцию. Проверь, что public.collection_state доступна через Data API и RLS разрешает чтение.",
      true
    );
    return;
  }

  if (!data) {
    cloudCollectionLoaded = false;
    showOwnerMessage("Запись коллекции не найдена. Проверь, что SQL с созданием таблицы выполнен успешно.", true);
    return;
  }

  let cloudOwned = Array.isArray(data.owned_ids)
    ? [...new Set(data.owned_ids.filter(id => typeof id === "string"))]
    : [];

  // Однократный перенос локальных отметок возможен только для владельца
  // и только если облачная коллекция пока пустая.
  if (allowMigration && isOwner && cloudOwned.length === 0 && localOwnedForMigration.length > 0) {
    const { error: migrationError } = await supabaseClient
      .from("collection_state")
      .update({
        owned_ids: localOwnedForMigration,
        updated_at: new Date().toISOString()
      })
      .eq("id", COLLECTION_ROW_ID);

    if (migrationError) {
      console.error("Не удалось перенести локальную коллекцию:", migrationError);
      showOwnerMessage("Коллекция загружена, но старые отметки не перенесены. Проверь права UPDATE.", true);
    } else {
      cloudOwned = [...localOwnedForMigration];
      showOwnerMessage("Старые отметки перенесены в облако.");
    }
  }

  owned = cloudOwned;
  cloudCollectionLoaded = true;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(owned));
  } catch (storageError) {
    console.warn("Не удалось обновить локальную копию коллекции:", storageError);
  }

  if (skins.length) renderSkins();

  if (isOwner) {
    showOwnerMessage("Вход выполнен. Изменения будут сохраняться в облаке.");
  } else {
    showOwnerMessage("Коллекция загружена. Посетители могут только просматривать её.");
  }
}

function saveOwned() {
  // Клиентский интерфейс также блокирует изменения для посетителей,
  // а окончательная защита обеспечивается RLS в Supabase.
  if (!isOwner || !supabaseClient || !cloudCollectionLoaded) {
    showOwnerMessage("Для изменения коллекции нужно войти в аккаунт владельца.", true);
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(owned));
  } catch (error) {
    console.warn("Не удалось сохранить локальную копию коллекции:", error);
  }

  const snapshot = [...owned];
  cloudSaveQueue = cloudSaveQueue
    .catch(() => {})
    .then(async () => {
      const { error } = await supabaseClient
        .from("collection_state")
        .update({
          owned_ids: snapshot,
          updated_at: new Date().toISOString()
        })
        .eq("id", COLLECTION_ROW_ID);

      if (error) {
        console.error("Не удалось сохранить коллекцию в Supabase:", error);
        showOwnerMessage("Ошибка облачного сохранения. Проверь соединение и права RLS.", true);
        return;
      }

      showOwnerMessage("Изменения сохранены в облаке.");
    });

  return true;
}

/* Изменение отдельного чекбокса */

elements.grid.addEventListener("change", event => {
  const checkbox = event.target;

  if (!checkbox.matches('input[type="checkbox"][data-id]')) {
    return;
  }

  if (!isOwner) {
    checkbox.checked = owned.includes(checkbox.dataset.id);
    showOwnerMessage("Коллекция доступна только для просмотра. Войди как владелец, чтобы редактировать.", true);
    return;
  }

  const id = checkbox.dataset.id;

  if (!id) return;

  if (checkbox.checked) {
    if (!owned.includes(id)) {
      owned.push(id);
    }
  } else {
    owned = owned.filter(item => item !== id);
  }

  saveOwned();
  renderSkins();
});

/* Массовая отметка видимых скинов */

function setVisibleSkins(checked) {
  if (!isOwner) {
    showOwnerMessage("Только владелец может изменять отметки.", true);
    return;
  }
  /*
   * Если включён фильтр «Только мои скины»,
   * массовые кнопки должны работать со всеми
   * скинами, подходящими под остальные фильтры.
   */
  const visibleSkins = getFilteredSkins({
    ignoreOwnedOnly: true
  });

  if (visibleSkins.length === 0) {
    return;
  }

  const visibleIds = new Set(
    visibleSkins.map(skin => skin.id)
  );

  if (checked) {
    const ownedSet = new Set(owned);

    visibleIds.forEach(id => ownedSet.add(id));

    owned = Array.from(ownedSet);
  } else {
    owned = owned.filter(id => !visibleIds.has(id));
  }

  saveOwned();
  renderSkins();
}

elements.selectAll.addEventListener("click", () => {
  setVisibleSkins(true);
});

elements.deselectAll.addEventListener("click", () => {
  setVisibleSkins(false);
});

/* Поиск */

elements.search.addEventListener("input", renderSkins);

/* Фильтр «Только мои скины» */

elements.ownedOnly.addEventListener("change", renderSkins);

/* Кнопка прокрутки вверх */

if (elements.backToTop) {
  let scrollTicking = false;

  window.addEventListener("scroll", () => {
    if (scrollTicking) return;

    scrollTicking = true;

    window.requestAnimationFrame(() => {
      elements.backToTop.classList.toggle(
        "visible",
        window.scrollY > 300
      );

      scrollTicking = false;
    });
  }, { passive: true });

  elements.backToTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
}

/* Загрузка каталога */

async function loadSkins() {
  elements.emptyMessage.textContent =
    "Загружаем каталог скинов...";

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(
        `Ошибка загрузки каталога: ${response.status}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(
        "API вернул данные в неожиданном формате."
      );
    }

    skins = data
      .filter(skin =>
        skin.wear?.name === "Factory New" &&
        rarityMap[skin.rarity?.name] &&
        skin.image &&
        skin.id
      )
      .map(skin => ({
        id: skin.id,
        name: (skin.name || "Неизвестный скин")
          .replace(/\s*\(Factory New\)\s*$/, ""),
        weaponName: skin.weapon?.name || "Оружие не указано",
        weaponCategory: getWeaponCategory(skin),
        rarity: rarityMap[skin.rarity.name],
        image: skin.image,
        isSouvenir: skin.souvenir === true,
        isStatTrak: skin.stattrak === true
      }));

    renderTabs();
    renderWeaponTabs();
    renderSkins();
  } catch (error) {
    console.error("Ошибка загрузки скинов:", error);

    elements.emptyMessage.textContent =
      "Не удалось загрузить каталог. Проверь интернет и обнови страницу.";
  }
}

/* Запуск */

renderTabs();
renderWeaponTabs();
renderOverallStats();
createOwnerPanel();
loadSkins();
initializeSupabase();