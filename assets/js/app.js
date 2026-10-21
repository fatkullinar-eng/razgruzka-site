/* ============================================================
   Публичная страница «Разгрузка»
   ============================================================ */

(function () {
  "use strict";

  var CONFIG = window.RAZGRUZKA_CONFIG || {};
  var DEMO_KEY = "razgruzka_demo_bookings";
  var client = null;
  var isConfigured = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
  var isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.protocol === "file:";

  document.documentElement.classList.add("js-ready");

  /* ---------- Меню ---------- */
  var burger = document.getElementById("burger");
  var navLinks = document.getElementById("navLinks");

  if (burger && navLinks) {
    burger.addEventListener("click", function () {
      var open = navLinks.classList.toggle("is-open");
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("nav-open", open);
    });

    navLinks.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        navLinks.classList.remove("is-open");
        burger.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
        document.body.classList.remove("nav-open");
      }
    });
  }

  /* ---------- Год в подвале ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Появление блоков ---------- */
  var reveals = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    reveals.forEach(function (el, index) {
      if (el.classList.contains("pain-card") || el.classList.contains("process__step")) {
        el.style.transitionDelay = (index % 3) * 90 + "ms";
      }
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* ---------- Политика конфиденциальности ---------- */
  var privacyDialog = document.getElementById("privacyDialog");

  if (privacyDialog) {
    document.querySelectorAll("[data-open-privacy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (typeof privacyDialog.showModal === "function") {
          privacyDialog.showModal();
        } else {
          privacyDialog.setAttribute("open", "");
        }
      });
    });

    document.querySelectorAll("[data-close-privacy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        privacyDialog.close();
      });
    });

    privacyDialog.addEventListener("click", function (event) {
      if (event.target === privacyDialog) privacyDialog.close();
    });
  }

  /* ---------- Кнопки «пробный сеанс» ---------- */
  var serviceSelect = document.getElementById("service");

  document.querySelectorAll("[data-service]").forEach(function (link) {
    link.addEventListener("click", function () {
      if (serviceSelect) serviceSelect.value = link.getAttribute("data-service");
    });
  });

  /* ---------- Телефон: маска ---------- */
  var phoneInput = document.getElementById("phone");

  if (phoneInput) {
    phoneInput.addEventListener("input", function () {
      var digits = phoneInput.value.replace(/\D/g, "");

      if (digits.startsWith("8")) digits = "7" + digits.slice(1);
      if (!digits.startsWith("7")) digits = "7" + digits;
      digits = digits.slice(0, 11);

      var out = "+7";
      if (digits.length > 1) out += " (" + digits.slice(1, 4);
      if (digits.length >= 5) out += ") " + digits.slice(4, 7);
      if (digits.length >= 8) out += "-" + digits.slice(7, 9);
      if (digits.length >= 10) out += "-" + digits.slice(9, 11);

      phoneInput.value = digits.length > 1 ? out : "";
    });
  }

  /* ---------- Supabase ---------- */
  if (isConfigured && window.supabase && typeof window.supabase.createClient === "function") {
    try {
      client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    } catch (error) {
      console.warn("Supabase не подключён:", error);
    }
  }

  /* ---------- Подстановка текстов ---------- */
  function applyContent(items) {
    if (!items || !items.length) return;

    var map = {};
    items.forEach(function (row) {
      if (row && row.key) map[row.key] = row.value;
    });

    document.querySelectorAll("[data-content]").forEach(function (el) {
      var key = el.getAttribute("data-content");
      if (Object.prototype.hasOwnProperty.call(map, key) && map[key] !== null && map[key] !== "") {
        el.textContent = map[key];
      }
    });

    document.querySelectorAll("[data-content-href]").forEach(function (el) {
      var key = el.getAttribute("data-content-href");
      if (!Object.prototype.hasOwnProperty.call(map, key) || !map[key]) return;

      var value = String(map[key]).trim();
      var href = value;

      if (key === "phone_link") {
        href = "tel:" + value.replace(/[^\d+]/g, "");
      } else if (key === "whatsapp_link" && !/^https?:\/\//i.test(value)) {
        href = "https://wa.me/" + value.replace(/\D/g, "");
      } else if (key === "telegram_link" && !/^https?:\/\//i.test(value)) {
        href = "https://t.me/" + value.replace(/^@/, "");
      }

      el.setAttribute("href", href);
    });

    if (map.master_photo) {
      var frame = document.querySelector("[data-master-photo]");
      if (frame) {
        frame.textContent = "";
        var photo = document.createElement("img");
        photo.src = map.master_photo;
        photo.alt = "Мастер" + (map.master_name ? " " + map.master_name : "");
        photo.loading = "lazy";
        frame.appendChild(photo);
      }
    }
  }

  async function loadContent() {
    if (!client) return;
    try {
      var result = await client.from("site_content").select("key,value");
      if (result.error) throw result.error;
      applyContent(result.data);
    } catch (error) {
      console.warn("Не удалось загрузить тексты:", error);
    }
  }

  /* ---------- Галерея ---------- */
  function renderGallery(rows) {
    var grid = document.getElementById("galleryGrid");
    if (!grid || !rows || !rows.length) return;

    grid.innerHTML = "";

    rows.forEach(function (row, index) {
      var path = row.storage_path || "";
      var src = path;

      if (path && !/^(https?:\/\/|data:)/i.test(path) && client) {
        var publicUrl = client.storage.from("gallery").getPublicUrl(path);
        src = publicUrl && publicUrl.data ? publicUrl.data.publicUrl : path;
      }

      if (!src) return;

      var figure = document.createElement("figure");
      figure.className = "gallery__item reveal";

      if (index % 6 === 0 || index % 6 === 5) figure.classList.add("gallery__item--wide");

      var img = document.createElement("img");
      img.src = src;
      img.alt = row.alt || row.title || "Массажный кабинет «Разгрузка»";
      img.loading = "lazy";
      img.decoding = "async";

      figure.appendChild(img);

      if (row.title) {
        var caption = document.createElement("figcaption");
        caption.textContent = row.title;
        figure.appendChild(caption);
      }

      grid.appendChild(figure);
      figure.classList.add("is-visible");
    });
  }

  async function loadGallery() {
    if (!client) return;
    try {
      var result = await client
        .from("gallery")
        .select("id,title,alt,storage_path,sort_order")
        .order("sort_order", { ascending: true });

      if (result.error) throw result.error;
      renderGallery(result.data);
    } catch (error) {
      console.warn("Не удалось загрузить галерею:", error);
    }
  }

  /* ---------- Форма записи ---------- */
  var form = document.getElementById("bookingForm");
  var status = document.getElementById("formStatus");

  function setStatus(message, type) {
    if (!status) return;
    status.textContent = message;
    status.className = "form-status field--full is-visible " + (type === "error" ? "is-error" : "is-success");
  }

  function getPhoneText() {
    var el = document.querySelector('[data-content="phone_display"]');
    var text = el ? el.textContent.trim() : "";
    return text || "+7 (999) 123-45-67";
  }

  function clearInvalid() {
    form.querySelectorAll(".invalid").forEach(function (el) {
      el.classList.remove("invalid");
    });
  }

  function validate() {
    var name = document.getElementById("name");
    var phone = document.getElementById("phone");
    var consent = form.querySelector('input[name="consent"]');
    var ok = true;

    clearInvalid();

    if (!name.value.trim()) {
      name.classList.add("invalid");
      ok = false;
    }

    var digits = phone.value.replace(/\D/g, "");
    if (digits.length < 11) {
      phone.classList.add("invalid");
      ok = false;
    }

    if (consent && !consent.checked) {
      setStatus("Поставьте галочку согласия на обработку данных — без неё мы не можем принять заявку.", "error");
      return false;
    }

    if (!ok) {
      setStatus("Проверьте имя и телефон: телефон нужен полностью, с кодом страны.", "error");
    }

    return ok;
  }

  function saveDemoBooking(payload) {
    var list = [];
    try {
      list = JSON.parse(localStorage.getItem(DEMO_KEY) || "[]");
    } catch (error) {
      list = [];
    }
    list.unshift(payload);
    localStorage.setItem(DEMO_KEY, JSON.stringify(list));
  }

  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!validate()) return;

      var submitBtn = form.querySelector('button[type="submit"]');
      var originalText = submitBtn ? submitBtn.textContent : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Отправляем…";
      }

      var payload = {
        name: document.getElementById("name").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        service: document.getElementById("service").value,
        preferred_time: document.getElementById("preferred").value.trim(),
        comment: document.getElementById("comment").value.trim(),
        status: "new"
      };

      try {
        if (client) {
          var result = await client.from("bookings").insert(payload);
          if (result.error) throw result.error;
          setStatus("Спасибо! Заявка отправлена. Перезвоним в течение 15 минут с 10:00 до 22:00.", "success");
        } else if (isLocal) {
          payload.id = "demo-" + Date.now();
          payload.created_at = new Date().toISOString();
          saveDemoBooking(payload);
          setStatus(
            "Демо-режим: заявка сохранена в этом браузере. После подключения Supabase она будет уходить в базу, а вы увидите её в личном кабинете.",
            "success"
          );
        } else {
          setStatus(
            "Онлайн-запись пока не подключена. Позвоните нам: " +
              getPhoneText() +
              " или напишите в мессенджер — запишем вручную.",
            "error"
          );
        }
        form.reset();
      } catch (error) {
        console.error(error);
        setStatus(
          "Не получилось отправить заявку. Позвоните или напишите в мессенджер — продублируем запись вручную.",
          "error"
        );
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
  }

  /* ---------- Демо-данные из кабинета ---------- */
  function loadDemoContent() {
    try {
      var map = JSON.parse(localStorage.getItem("razgruzka_demo_content") || "{}");
      var rows = Object.keys(map).map(function (key) {
        return { key: key, value: map[key] };
      });
      applyContent(rows);
    } catch (error) {
      console.warn("Демо-тексты не загрузились:", error);
    }
  }

  function loadDemoGallery() {
    try {
      var rows = JSON.parse(localStorage.getItem("razgruzka_demo_gallery") || "[]");
      var mapped = rows.map(function (row) {
        return Object.assign({}, row, {
          storage_path: row.dataUrl || row.storage_path
        });
      });
      renderGallery(mapped);
    } catch (error) {
      console.warn("Демо-галерея не загрузилась:", error);
    }
  }

  if (form && !client && !isLocal) {
    var notice = document.createElement("p");
    notice.className = "form-status field--full is-visible is-error";
    notice.textContent =
      "Онлайн-запись пока не подключена. Позвоните: " +
      getPhoneText() +
      " или напишите в мессенджер.";
    form.prepend(notice);

    var submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Позвоните нам";
    }
  }

  /* ---------- Загрузка данных ---------- */
  if (client) {
    loadContent();
    loadGallery();
  } else {
    loadDemoContent();
    loadDemoGallery();
  }

  window.RAZGRUZKA_IS_CONFIGURED = isConfigured;
})();
