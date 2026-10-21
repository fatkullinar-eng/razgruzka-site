/* ============================================================
   Личный кабинет «Разгрузка»
   Работает в двух режимах:
   1) Supabase подключён — настоящий вход и общие данные.
   2) Supabase не подключён и открыто локально — демо-режим
      на этом браузере (localStorage).
   ============================================================ */

(function () {
  "use strict";

  var CONFIG = window.RAZGRUZKA_CONFIG || {};
  var configured = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
  var isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.protocol === "file:";
  var demo = !configured && isLocal;
  var client = null;

  var KEY_CONTENT = "razgruzka_demo_content";
  var KEY_GALLERY = "razgruzka_demo_gallery";
  var KEY_BOOKINGS = "razgruzka_demo_bookings";
  var KEY_AUTH = "razgruzka_demo_auth";

  var DEFAULT_CONTENT = {
    hero_h2:
      "Один мастер ведёт вас от диагностики до последней минуты — без «сейчас подойдёт сменщик». 60 минут — это 60 минут рук на теле. Первый визит — 2 900 ₽, без предоплаты.",
    phone_display: "+7 (999) 123-45-67",
    phone_link: "+79991234567",
    whatsapp_link: "https://wa.me/79991234567",
    telegram_link: "https://t.me/razgruzka_msk",
    address: "Москва, ул. Малая Бронная, 12",
    metro: "Пушкинская",
    hours: "Ежедневно 10:00–22:00",
    master_name: "Анна Ковалёва",
    master_role: "массажист, специализация — шея и спина",
    master_experience: "8 лет практики",
    master_education: "Медицинское образование, сертификаты по миофасциальному и лечебному массажу",
    master_photo: "",
    price_30: "2 300",
    price_60: "3 900",
    price_90: "5 400",
    first_visit_price: "2 900",
    trial_price: "1 500",
    free_slots: "вторник 19:30, четверг 20:00, суббота 11:00",
    legal_name: "ИП Ковалёва Анна Сергеевна",
    legal_inn: "770000000000"
  };

  var SERVICE_LABELS = {
    first: "Первый визит — 60 минут",
    trial: "Пробный сеанс — 30 минут",
    long: "90 минут",
    unknown: "Пока не знает — подсказать"
  };

  var state = {
    content: {},
    gallery: [],
    bookings: [],
    email: ""
  };

  /* ---------- Короткие помощники ---------- */

  function $(id) {
    return document.getElementById(id);
  }

  function readLS(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeLS(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function status(el, message, type) {
    if (!el) return;
    el.textContent = message;
    el.className =
      "form-status is-visible " + (type === "error" ? "is-error" : "is-success");
  }

  function clearStatus(el) {
    if (!el) return;
    el.textContent = "";
    el.className = "form-status";
  }

  function serviceLabel(value) {
    return SERVICE_LABELS[value] || value || "Не указано";
  }

  function formatDate(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function downloadFile(name, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function safeFileName(name) {
    return String(name)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-64) || "photo";
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ---------- DOM ---------- */

  var loginView = $("loginView");
  var appView = $("appView");
  var loginForm = $("loginForm");
  var loginStatus = $("loginStatus");
  var loginBtn = $("loginBtn");
  var demoNote = $("demoNote");
  var modeBadge = $("modeBadge");
  var userEmail = $("userEmail");
  var logoutBtn = $("logoutBtn");
  var contentForm = $("contentForm");
  var contentStatus = $("contentStatus");
  var uploadForm = $("uploadForm");
  var uploadStatus = $("uploadStatus");
  var photoInput = $("photoInput");
  var uploadPreview = $("uploadPreview");
  var adminGallery = $("adminGallery");
  var galleryEmpty = $("galleryEmpty");
  var bookingsList = $("bookingsList");
  var bookingsEmpty = $("bookingsEmpty");
  var bookingsCount = $("bookingsCount");
  var exportCsv = $("exportCsv");
  var masterPhotoInput = $("masterPhotoInput");
  var masterPhotoPreview = $("masterPhotoPreview");
  var masterPhotoSave = $("masterPhotoSave");
  var masterPhotoRemove = $("masterPhotoRemove");
  var masterPhotoStatus = $("masterPhotoStatus");

  /* ---------- Инициализация ---------- */

  if (configured) {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    } else {
      status(loginStatus, "Не загрузился Supabase. Проверьте интернет и обновите страницу.", "error");
    }
  } else if (demo) {
    if (demoNote) demoNote.hidden = false;
  } else {
    status(
      loginStatus,
      "Кабинет ещё не подключён к базе. Администратору нужно вписать адрес и ключ Supabase в файл assets/js/config.js.",
      "error"
    );
    if (loginBtn) loginBtn.disabled = true;
  }

  async function checkSession() {
    if (configured && client) {
      try {
        var result = await client.auth.getSession();
        var session = result && result.data ? result.data.session : null;
        if (session && session.user) {
          showApp(session.user.email || "администратор");
        }
      } catch (error) {
        console.warn(error);
      }
      return;
    }

    if (demo && sessionStorage.getItem(KEY_AUTH) === "1") {
      showApp("demo@localhost");
    }
  }

  function showApp(email) {
    state.email = email;
    if (loginView) loginView.hidden = true;
    if (appView) appView.hidden = false;
    if (userEmail) userEmail.textContent = email;
    if (modeBadge) modeBadge.hidden = !demo;
    loadContent();
    loadGallery();
    loadBookings();
  }

  function showLogin() {
    if (appView) appView.hidden = true;
    if (loginView) loginView.hidden = false;
  }

  /* ---------- Вход и выход ---------- */

  if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      clearStatus(loginStatus);

      var email = $("email").value.trim();
      var password = $("password").value;

      if (!email || !password) {
        status(loginStatus, "Введите e-mail и пароль.", "error");
        return;
      }

      if (demo) {
        sessionStorage.setItem(KEY_AUTH, "1");
        showApp(email);
        return;
      }

      if (!client) {
        status(loginStatus, "Нет подключения к базе. Обновите страницу.", "error");
        return;
      }

      if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = "Входим…";
      }

      try {
        var result = await client.auth.signInWithPassword({ email: email, password: password });
        if (result.error) throw result.error;
        showApp(result.data.user ? result.data.user.email : email);
      } catch (error) {
        console.error(error);
        status(
          loginStatus,
          error && error.message
            ? "Не удалось войти: " + error.message
            : "Неверный e-mail или пароль.",
          "error"
        );
      } finally {
        if (loginBtn) {
          loginBtn.disabled = false;
          loginBtn.textContent = "Войти";
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      if (configured && client) {
        try {
          await client.auth.signOut();
        } catch (error) {
          console.warn(error);
        }
      }
      sessionStorage.removeItem(KEY_AUTH);
      location.reload();
    });
  }

  /* ---------- Вкладки ---------- */

  document.querySelectorAll(".admin-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var name = tab.getAttribute("data-tab");

      document.querySelectorAll(".admin-tab").forEach(function (item) {
        var active = item === tab;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
      });

      document.querySelectorAll("[data-panel]").forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-panel") !== name;
      });
    });
  });

  /* ============================================================
     КОНТЕНТ
     ============================================================ */

  function effectiveContent() {
    var stored = demo ? readLS(KEY_CONTENT, {}) : state.content;
    return Object.assign({}, DEFAULT_CONTENT, stored || {});
  }

  function fillContentForm(map) {
    document.querySelectorAll("[data-key]").forEach(function (input) {
      var key = input.getAttribute("data-key");
      if (Object.prototype.hasOwnProperty.call(map, key)) {
        input.value = map[key] == null ? "" : map[key];
      }
    });

    renderMasterPreview(map.master_photo);
  }

  function renderMasterPreview(url) {
    if (!masterPhotoPreview) return;
    masterPhotoPreview.innerHTML = "";

    if (url) {
      var img = document.createElement("img");
      img.src = url;
      img.alt = "Фото мастера";
      masterPhotoPreview.appendChild(img);
    } else {
      var span = document.createElement("span");
      span.textContent = "Нет фото";
      masterPhotoPreview.appendChild(span);
    }
  }

  async function loadContent() {
    if (demo) {
      fillContentForm(effectiveContent());
      return;
    }

    if (!client) return;

    try {
      var result = await client.from("site_content").select("key,value");
      if (result.error) throw result.error;

      var map = {};
      (result.data || []).forEach(function (row) {
        map[row.key] = row.value;
      });

      state.content = map;
      fillContentForm(effectiveContent());
    } catch (error) {
      console.warn(error);
      status(contentStatus, "Не удалось загрузить тексты из базы.", "error");
    }
  }

  if (contentForm) {
    contentForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      clearStatus(contentStatus);

      var values = {};
      contentForm.querySelectorAll("[data-key]").forEach(function (input) {
        values[input.getAttribute("data-key")] = input.value.trim();
      });

      if (demo) {
        var merged = Object.assign({}, readLS(KEY_CONTENT, {}), values);
        var saved = writeLS(KEY_CONTENT, merged);
        if (!saved) {
          status(contentStatus, "Не удалось сохранить: в браузере закончилось место.", "error");
          return;
        }
        state.content = merged;
        status(contentStatus, "Сохранено. Обновите страницу сайта — изменения уже там.", "success");
        return;
      }

      if (!client) {
        status(contentStatus, "Нет подключения к базе.", "error");
        return;
      }

      var rows = Object.keys(values).map(function (key) {
        return { key: key, value: values[key] };
      });

      try {
        var result = await client.from("site_content").upsert(rows, { onConflict: "key" });
        if (result.error) throw result.error;
        state.content = Object.assign({}, state.content, values);
        status(contentStatus, "Сохранено. Изменения уже на сайте.", "success");
      } catch (error) {
        console.error(error);
        status(contentStatus, "Не удалось сохранить. Попробуйте ещё раз.", "error");
      }
    });
  }

  /* ============================================================
     ГАЛЕРЕЯ
     ============================================================ */

  function publicUrl(path) {
    if (!path) return "";
    if (/^(https?:\/\/|data:)/i.test(path)) return path;
    if (!client) return path;
    var result = client.storage.from("gallery").getPublicUrl(path);
    return result && result.data ? result.data.publicUrl : path;
  }

  async function loadGallery() {
    if (demo) {
      state.gallery = readLS(KEY_GALLERY, []);
      renderAdminGallery();
      return;
    }

    if (!client) return;

    try {
      var result = await client
        .from("gallery")
        .select("id,title,alt,storage_path,sort_order,created_at")
        .order("sort_order", { ascending: true });

      if (result.error) throw result.error;
      state.gallery = result.data || [];
      renderAdminGallery();
    } catch (error) {
      console.warn(error);
      status(uploadStatus, "Не удалось загрузить фотографии из базы.", "error");
    }
  }

  function renderAdminGallery() {
    if (!adminGallery) return;
    adminGallery.innerHTML = "";

    var hasPhotos = state.gallery.length > 0;
    if (galleryEmpty) galleryEmpty.hidden = hasPhotos;

    state.gallery.forEach(function (item, index) {
      var card = document.createElement("article");
      card.className = "admin-photo";

      var imageWrap = document.createElement("div");
      imageWrap.className = "admin-photo__img";

      var img = document.createElement("img");
      img.src = publicUrl(item.dataUrl || item.storage_path);
      img.alt = item.alt || item.title || "Фото кабинета";
      img.loading = "lazy";
      imageWrap.appendChild(img);

      var body = document.createElement("div");
      body.className = "admin-photo__body";

      var title = document.createElement("strong");
      title.textContent = item.title || "Без подписи";

      var alt = document.createElement("span");
      alt.textContent = item.alt ? "alt: " + item.alt : "Описание для поиска не заполнено";

      var actions = document.createElement("div");
      actions.className = "admin-photo__actions";

      var up = document.createElement("button");
      up.type = "button";
      up.textContent = "↑";
      up.title = "Выше";
      up.disabled = index === 0;
      up.addEventListener("click", function () {
        movePhoto(index, -1);
      });

      var down = document.createElement("button");
      down.type = "button";
      down.textContent = "↓";
      down.title = "Ниже";
      down.disabled = index === state.gallery.length - 1;
      down.addEventListener("click", function () {
        movePhoto(index, 1);
      });

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger";
      remove.textContent = "Удалить";
      remove.addEventListener("click", function () {
        deletePhoto(item);
      });

      actions.appendChild(up);
      actions.appendChild(down);
      actions.appendChild(remove);

      body.appendChild(title);
      body.appendChild(alt);
      body.appendChild(actions);

      card.appendChild(imageWrap);
      card.appendChild(body);
      adminGallery.appendChild(card);
    });
  }

  function movePhoto(index, direction) {
    var target = index + direction;
    if (target < 0 || target >= state.gallery.length) return;

    var temp = state.gallery[index];
    state.gallery[index] = state.gallery[target];
    state.gallery[target] = temp;

    if (demo) {
      writeLS(KEY_GALLERY, state.gallery);
      renderAdminGallery();
      return;
    }

    persistGalleryOrder();
  }

  async function persistGalleryOrder() {
    if (!client) return;

    try {
      for (var i = 0; i < state.gallery.length; i += 1) {
        var row = state.gallery[i];
        var result = await client.from("gallery").update({ sort_order: i }).eq("id", row.id);
        if (result.error) throw result.error;
        row.sort_order = i;
      }
      status(uploadStatus, "Порядок сохранён.", "success");
    } catch (error) {
      console.error(error);
      status(uploadStatus, "Не удалось сохранить порядок фото.", "error");
    }

    renderAdminGallery();
  }

  async function deletePhoto(item) {
    var ok = window.confirm(
      "Удалить фото «" + (item.title || "без подписи") + "»?\n\nОно исчезнет с сайта. Это действие нельзя отменить."
    );
    if (!ok) return;

    if (demo) {
      state.gallery = state.gallery.filter(function (row) {
        return row !== item;
      });
      writeLS(KEY_GALLERY, state.gallery);
      renderAdminGallery();
      status(uploadStatus, "Фото удалено.", "success");
      return;
    }

    if (!client) return;

    try {
      if (item.storage_path) {
        var removed = await client.storage.from("gallery").remove([item.storage_path]);
        if (removed.error) throw removed.error;
      }

      var result = await client.from("gallery").delete().eq("id", item.id);
      if (result.error) throw result.error;

      state.gallery = state.gallery.filter(function (row) {
        return row.id !== item.id;
      });
      renderAdminGallery();
      status(uploadStatus, "Фото удалено с сайта.", "success");
    } catch (error) {
      console.error(error);
      status(uploadStatus, "Не удалось удалить фото. Попробуйте ещё раз.", "error");
    }
  }

  if (photoInput) {
    photoInput.addEventListener("change", function () {
      var file = photoInput.files && photoInput.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        uploadPreview.innerHTML = "";
        var img = document.createElement("img");
        img.src = String(reader.result);
        img.alt = "Предпросмотр загружаемого фото";
        uploadPreview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  }

  if (uploadForm) {
    uploadForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      clearStatus(uploadStatus);

      var file = photoInput && photoInput.files ? photoInput.files[0] : null;
      if (!file) {
        status(uploadStatus, "Сначала выберите фото.", "error");
        return;
      }

      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        status(uploadStatus, "Подойдёт JPG, PNG или WebP.", "error");
        return;
      }

      var limit = demo ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > limit) {
        status(
          uploadStatus,
          demo ? "В демо-режиме — до 2 МБ. После подключения Supabase будет до 5 МБ." : "Фото больше 5 МБ. Сожмите его и попробуйте снова.",
          "error"
        );
        return;
      }

      var title = $("photoTitle").value.trim() || file.name.replace(/\.[^.]+$/, "");
      var alt = $("photoAlt").value.trim() || "Массажный кабинет «Разгрузка»: " + title;

      if (demo) {
        var reader = new FileReader();
        reader.onload = function () {
          state.gallery.push({
            id: "demo-" + Date.now(),
            title: title,
            alt: alt,
            dataUrl: String(reader.result),
            sort_order: state.gallery.length
          });

          var saved = writeLS(KEY_GALLERY, state.gallery);
          if (!saved) {
            state.gallery.pop();
            status(uploadStatus, "Не хватило места в браузере. Удалите старые демо-фото.", "error");
            return;
          }

          renderAdminGallery();
          uploadForm.reset();
          uploadPreview.innerHTML = "<span>Предпросмотр</span>";
          status(uploadStatus, "Фото добавлено. Обновите страницу сайта — оно уже там.", "success");
        };
        reader.readAsDataURL(file);
        return;
      }

      if (!client) {
        status(uploadStatus, "Нет подключения к базе.", "error");
        return;
      }

      var path = "gallery/" + Date.now() + "-" + safeFileName(file.name);

      try {
        var uploaded = await client.storage.from("gallery").upload(path, file, {
          cacheControl: "3600",
          upsert: false
        });
        if (uploaded.error) throw uploaded.error;

        var inserted = await client
          .from("gallery")
          .insert({
            title: title,
            alt: alt,
            storage_path: path,
            sort_order: state.gallery.length
          })
          .select("id,title,alt,storage_path,sort_order,created_at")
          .single();

        if (inserted.error) {
          await client.storage.from("gallery").remove([path]);
          throw inserted.error;
        }

        state.gallery.push(inserted.data);
        renderAdminGallery();
        uploadForm.reset();
        uploadPreview.innerHTML = "<span>Предпросмотр</span>";
        status(uploadStatus, "Фото загружено и уже на сайте.", "success");
      } catch (error) {
        console.error(error);
        status(uploadStatus, "Не удалось загрузить фото. Попробуйте ещё раз.", "error");
      }
    });
  }

  /* ---------- Фото мастера ---------- */

  if (masterPhotoInput) {
    masterPhotoInput.addEventListener("change", function () {
      var file = masterPhotoInput.files && masterPhotoInput.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        renderMasterPreview(String(reader.result));
      };
      reader.readAsDataURL(file);
    });
  }

  if (masterPhotoSave) {
    masterPhotoSave.addEventListener("click", async function () {
      clearStatus(masterPhotoStatus);

      var file = masterPhotoInput && masterPhotoInput.files ? masterPhotoInput.files[0] : null;
      if (!file) {
        status(masterPhotoStatus, "Сначала выберите фото мастера.", "error");
        return;
      }

      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        status(masterPhotoStatus, "Подойдёт JPG, PNG или WebP.", "error");
        return;
      }

      var limit = demo ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > limit) {
        status(
          masterPhotoStatus,
          demo
            ? "В демо-режиме — до 2 МБ. После подключения Supabase будет до 5 МБ."
            : "Фото больше 5 МБ. Сожмите его и попробуйте снова.",
          "error"
        );
        return;
      }

      masterPhotoSave.disabled = true;
      masterPhotoSave.textContent = "Загружаем…";

      try {
        if (demo) {
          var dataUrl = await readFileAsDataUrl(file);
          var stored = Object.assign({}, readLS(KEY_CONTENT, {}), { master_photo: dataUrl });
          if (!writeLS(KEY_CONTENT, stored)) {
            throw new Error("Не хватило места в браузере");
          }
          state.content = stored;
          renderMasterPreview(dataUrl);
          status(masterPhotoStatus, "Фото мастера сохранено. Обновите страницу сайта — оно уже там.", "success");
        } else {
          if (!client) throw new Error("Нет подключения к базе");

          var path = "master/" + Date.now() + "-" + safeFileName(file.name);
          var uploaded = await client.storage.from("gallery").upload(path, file, {
            cacheControl: "3600",
            upsert: false
          });
          if (uploaded.error) throw uploaded.error;

          var url = publicUrl(path);
          var saved = await client
            .from("site_content")
            .upsert({ key: "master_photo", value: url }, { onConflict: "key" });
          if (saved.error) throw saved.error;

          state.content.master_photo = url;
          renderMasterPreview(url);
          status(masterPhotoStatus, "Фото мастера сохранено и уже на сайте.", "success");
        }

        masterPhotoInput.value = "";
      } catch (error) {
        console.error(error);
        status(masterPhotoStatus, "Не удалось сохранить фото мастера. Попробуйте ещё раз.", "error");
      } finally {
        masterPhotoSave.disabled = false;
        masterPhotoSave.textContent = "Загрузить фото мастера";
      }
    });
  }

  if (masterPhotoRemove) {
    masterPhotoRemove.addEventListener("click", async function () {
      var ok = window.confirm(
        "Удалить фото мастера?\n\nНа сайте вернётся рамка-заглушка. Это действие нельзя отменить."
      );
      if (!ok) return;

      clearStatus(masterPhotoStatus);

      try {
        if (demo) {
          var stored = Object.assign({}, readLS(KEY_CONTENT, {}), { master_photo: "" });
          if (!writeLS(KEY_CONTENT, stored)) throw new Error("Не хватило места в браузере");
          state.content = stored;
        } else {
          if (!client) throw new Error("Нет подключения к базе");

          var old = state.content.master_photo || "";
          var marker = "/gallery/";
          var index = old.indexOf(marker);
          if (index !== -1) {
            var path = old.slice(index + marker.length).split("?")[0];
            if (path) {
              try {
                await client.storage.from("gallery").remove([path]);
              } catch (error) {
                console.warn("Старый файл не удалён:", error);
              }
            }
          }

          var saved = await client
            .from("site_content")
            .upsert({ key: "master_photo", value: "" }, { onConflict: "key" });
          if (saved.error) throw saved.error;

          state.content.master_photo = "";
        }

        renderMasterPreview("");
        if (masterPhotoInput) masterPhotoInput.value = "";
        status(masterPhotoStatus, "Фото мастера удалено.", "success");
      } catch (error) {
        console.error(error);
        status(masterPhotoStatus, "Не удалось удалить фото мастера. Попробуйте ещё раз.", "error");
      }
    });
  }

  /* ============================================================
     ЗАЯВКИ
     ============================================================ */

  async function loadBookings() {
    if (demo) {
      state.bookings = readLS(KEY_BOOKINGS, []);
      renderBookings();
      return;
    }

    if (!client) return;

    try {
      var result = await client
        .from("bookings")
        .select("id,name,phone,service,preferred_time,comment,status,created_at")
        .order("created_at", { ascending: false });

      if (result.error) throw result.error;
      state.bookings = result.data || [];
      renderBookings();
    } catch (error) {
      console.warn(error);
    }
  }

  function updateBookingsCount() {
    if (!bookingsCount) return;
    var fresh = state.bookings.filter(function (row) {
      return row.status !== "done";
    }).length;
    bookingsCount.textContent = String(fresh);
  }

  function renderBookings() {
    if (!bookingsList) return;
    bookingsList.innerHTML = "";
    updateBookingsCount();

    var hasBookings = state.bookings.length > 0;
    if (bookingsEmpty) bookingsEmpty.hidden = hasBookings;

    state.bookings.forEach(function (item) {
      var card = document.createElement("article");
      card.className = "booking-card" + (item.status === "done" ? " booking-card--done" : "");

      var when = document.createElement("div");
      var date = document.createElement("p");
      date.className = "booking-card__date";
      date.textContent = formatDate(item.created_at);
      var name = document.createElement("p");
      name.className = "booking-card__name";
      name.textContent = item.name || "Без имени";
      var phone = document.createElement("a");
      phone.className = "booking-card__phone";
      phone.href = "tel:" + String(item.phone || "").replace(/[^\d+]/g, "");
      phone.textContent = item.phone || "Телефон не указан";
      when.appendChild(date);
      when.appendChild(name);
      when.appendChild(phone);

      var details = document.createElement("div");
      var service = document.createElement("p");
      service.className = "booking-card__service";
      service.textContent = serviceLabel(item.service);
      var preferred = document.createElement("p");
      preferred.className = "booking-card__meta";
      preferred.textContent = item.preferred_time
        ? "Удобное время: " + item.preferred_time
        : "Удобное время не указано";
      details.appendChild(service);
      details.appendChild(preferred);
      if (item.comment) {
        var comment = document.createElement("p");
        comment.className = "booking-card__comment";
        comment.textContent = item.comment;
        details.appendChild(comment);
      }

      var statusWrap = document.createElement("div");
      var badge = document.createElement("span");
      var isDone = item.status === "done";
      badge.className = "booking-card__status" + (isDone ? "" : " booking-card__status--new");
      badge.textContent = isDone ? "обработана" : "новая";
      statusWrap.appendChild(badge);

      var actions = document.createElement("div");
      actions.className = "booking-card__actions";

      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.textContent = isDone ? "Вернуть в новые" : "Отметить обработанной";
      toggle.addEventListener("click", function () {
        toggleStatus(item, isDone ? "new" : "done");
      });

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger";
      remove.textContent = "Удалить";
      remove.addEventListener("click", function () {
        deleteBooking(item);
      });

      actions.appendChild(toggle);
      actions.appendChild(remove);

      card.appendChild(when);
      card.appendChild(details);
      card.appendChild(statusWrap);
      card.appendChild(actions);
      bookingsList.appendChild(card);
    });
  }

  async function toggleStatus(item, nextStatus) {
    item.status = nextStatus;

    if (demo) {
      writeLS(KEY_BOOKINGS, state.bookings);
      renderBookings();
      return;
    }

    if (!client) return;

    try {
      var result = await client.from("bookings").update({ status: nextStatus }).eq("id", item.id);
      if (result.error) throw result.error;
      renderBookings();
    } catch (error) {
      console.error(error);
      window.alert("Не удалось обновить статус заявки. Попробуйте ещё раз.");
    }
  }

  async function deleteBooking(item) {
    var ok = window.confirm(
      "Удалить заявку от «" + (item.name || "без имени") + "»?\n\nОна исчезнет из кабинета. Это действие нельзя отменить."
    );
    if (!ok) return;

    if (demo) {
      state.bookings = state.bookings.filter(function (row) {
        return row !== item;
      });
      writeLS(KEY_BOOKINGS, state.bookings);
      renderBookings();
      return;
    }

    if (!client) return;

    try {
      var result = await client.from("bookings").delete().eq("id", item.id);
      if (result.error) throw result.error;
      state.bookings = state.bookings.filter(function (row) {
        return row.id !== item.id;
      });
      renderBookings();
    } catch (error) {
      console.error(error);
      window.alert("Не удалось удалить заявку. Попробуйте ещё раз.");
    }
  }

  if (exportCsv) {
    exportCsv.addEventListener("click", function () {
      if (!state.bookings.length) {
        window.alert("Пока нет заявок для выгрузки.");
        return;
      }

      var header = ["Дата", "Имя", "Телефон", "Услуга", "Удобное время", "Комментарий", "Статус"];
      var lines = [header.map(csvCell).join(";")];

      state.bookings.forEach(function (item) {
        lines.push(
          [
            formatDate(item.created_at),
            item.name || "",
            item.phone || "",
            serviceLabel(item.service),
            item.preferred_time || "",
            item.comment || "",
            item.status === "done" ? "обработана" : "новая"
          ]
            .map(csvCell)
            .join(";")
        );
      });

      var date = new Date().toISOString().slice(0, 10);
      downloadFile("zayavki-razgruzka-" + date + ".csv", "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8");
    });
  }

  function csvCell(value) {
    var text = String(value == null ? "" : value).replace(/"/g, '""');
    return '"' + text + '"';
  }

  /* ---------- Старт ---------- */

  checkSession();
})();
