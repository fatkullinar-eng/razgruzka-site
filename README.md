# «Разгрузка» — сайт массажного кабинета

Одностраничный сайт и личный кабинет владельца.

## Публикация

- Сайт: https://fatkullinar-eng.github.io/razgruzka-site/
- Репозиторий: https://github.com/fatkullinar-eng/razgruzka-site
- Хостинг: GitHub Pages, ветка `main`, папка `/`.
- Форма записи отключена до подключения Supabase: на сайте показывается телефон, а не ложное «заявка сохранена».

## Быстрый старт

```powershell
cd C:\Users\user\meetcakech
node tmp/serve-massage.js
```

- Сайт: http://localhost:4173
- Кабинет: http://localhost:4173/admin/

В демо-режиме вход в кабинет — с любым e-mail и паролем. Данные сохраняются только в текущем браузере.

## Структура

- `index.html` — публичная страница.
- `assets/css/styles.css` — оформление.
- `assets/js/app.js` — галерея, тексты, форма записи.
- `assets/js/config.js` — URL и anon key Supabase.
- `admin/` — личный кабинет.
- `supabase/schema.sql` — таблицы, права, хранилище.
- `supabase/seed.sql` — стартовые тексты и цены.
- `robots.txt`, `sitemap.xml` — для поисковиков.
- `netlify.toml` — настройки публикации.

## Подключение Supabase

1. Создайте проект на supabase.com.
2. Выполните `supabase/schema.sql`, затем `supabase/seed.sql` в SQL Editor.
3. Создайте пользователя в Authentication → Users.
4. Вставьте Project URL и anon public key в `assets/js/config.js`.
5. Войдите в `/admin/` с созданным e-mail и паролем.

Подробная инструкция для владельца: `../docs/2026-10-21-massage-site-guide.md`.

Промты Midjourney для фото: `../docs/2026-10-21-massage-photo-prompts.md`.

## Важно

- В код вставляется только `anon public` key. `service_role` не использовать.
- Сайт уже опубликован на GitHub Pages: `https://fatkullinar-eng.github.io/razgruzka-site/`. Если позже подключите свой домен, замените адрес в `index.html`, `robots.txt`, `sitemap.xml`.
- Замените примерные данные: телефон `+7 (999) 123-45-67`, адрес, ИНН `770000000000`, имя мастера. Они вымышленные и нужны только для демонстрации.
