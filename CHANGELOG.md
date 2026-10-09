# Changelog

## [0.5.0](https://github.com/AlexPanich/ai-for-developers-project-387/compare/v0.4.0...v0.5.0) (2026-10-09)


### Features

* перенести приложение «Календарь звонков» из предыдущего репозитория ([c99364d](https://github.com/AlexPanich/ai-for-developers-project-387/commit/c99364d28da3d9e892475faa99228acdcf7b7a85))


### Bug Fixes

* **frontend:** подписать московское время на /events ([1649e8f](https://github.com/AlexPanich/ai-for-developers-project-387/commit/1649e8fd02b489168c1c853d0c7e8d75c6465bdf)), closes [#3](https://github.com/AlexPanich/ai-for-developers-project-387/issues/3)
* **frontend:** увеличить шрифт подписи «Время по Москве» ([ed5b360](https://github.com/AlexPanich/ai-for-developers-project-387/commit/ed5b3604c0c2ff66a62fcc74123a0f16cafb13f2))

## [0.4.0](https://github.com/AlexPanich/ai-for-developers-project-386/compare/v0.3.0...v0.4.0) (2026-10-06)


### Features

* **backend:** POST /bookings — валидация startAt, хранение и 409 SLOT_TAKEN ([f857e6b](https://github.com/AlexPanich/ai-for-developers-project-386/commit/f857e6b52790770af528a4120b81e0d51a06790b))
* **backend:** вычисление слотов доступности по сетке и окну 14 дней ([8414288](https://github.com/AlexPanich/ai-for-developers-project-386/commit/841428863f3c8b7fef104691e4e21982f6b1949c)), closes [#21](https://github.com/AlexPanich/ai-for-developers-project-386/issues/21)
* **backend:** генерация типов и TypeBox-схем из контракта ([b95b7f3](https://github.com/AlexPanich/ai-for-developers-project-386/commit/b95b7f388dc9a3cdf41e2e461680d37907dc1195))
* **backend:** список предстоящих встреч в GET /api/bookings ([f5ec57e](https://github.com/AlexPanich/ai-for-developers-project-386/commit/f5ec57e979b455e0bca58051dbfe8d773fd6183c))
* **backend:** список типов событий и выборка типа по id из SQLite ([c65e8ea](https://github.com/AlexPanich/ai-for-developers-project-386/commit/c65e8eaaccc194154bd37718f7f60112f3f5b607))
* **backend:** хост SPA и API на одном порту, слушает $PORT ([048006f](https://github.com/AlexPanich/ai-for-developers-project-386/commit/048006f769397cc3fa87cf93d5f4840234ff7785))
* **backend:** хранение типов событий в SQLite и POST /api/event-types ([6980b96](https://github.com/AlexPanich/ai-for-developers-project-386/commit/6980b960c343e606a65bed9a3659a3fbeda02d25))
* **contract:** добавить API-контракт TypeSpec и каркас contract/ ([05c4a55](https://github.com/AlexPanich/ai-for-developers-project-386/commit/05c4a55ee1a7685c75e16dbe5ba954da310fd158))
* **contract:** словарь ошибок и границы валидации ([a94a165](https://github.com/AlexPanich/ai-for-developers-project-386/commit/a94a165422c2b745e6ec9dac8c2a1fee581d92c2))
* **frontend:** клиентский SDK из контракта вместо рукописных эндпоинтов ([ff9e859](https://github.com/AlexPanich/ai-for-developers-project-386/commit/ff9e85986cdb240443c44a194469135be2103915))
* **frontend:** лендинг под SPEC §6 ([c44d191](https://github.com/AlexPanich/ai-for-developers-project-386/commit/c44d1916ac4a2504dec3247bfd907ea57477e975))
* **frontend:** страница /admin с guard и формой создания типа события ([1430178](https://github.com/AlexPanich/ai-for-developers-project-386/commit/14301783c46f944edf7ae8a94c277ca5d40fecff))
* **frontend:** страница /book со списком типов событий ([dfb9427](https://github.com/AlexPanich/ai-for-developers-project-386/commit/dfb94276d026f2d72e125ad9a1c2f567a6975c0b))
* **frontend:** страница /events со списком предстоящих встреч ([43f445d](https://github.com/AlexPanich/ai-for-developers-project-386/commit/43f445d1712b1591ed43fcd33c5d16f95a3b9248))
* **frontend:** типы контракта и API-клиент ([39fe105](https://github.com/AlexPanich/ai-for-developers-project-386/commit/39fe105e08b583963fd947ac8c39ce47041c26b2)), closes [#18](https://github.com/AlexPanich/ai-for-developers-project-386/issues/18)
* **frontend:** шаг «Календарь» — месячная сетка, бейджи и слоты ([988916a](https://github.com/AlexPanich/ai-for-developers-project-386/commit/988916ac398b14d64a2f36d6a589b9596c6ca372)), closes [#21](https://github.com/AlexPanich/ai-for-developers-project-386/issues/21)
* **frontend:** шаги «Информация» и «Подтверждение записи» мастера бронирования ([1710e16](https://github.com/AlexPanich/ai-for-developers-project-386/commit/1710e1605a4282c57cab0855403d7ff6853ba70d))


### Bug Fixes

* **contract:** добавить 404 для несуществующего типа в POST /bookings ([b0b4700](https://github.com/AlexPanich/ai-for-developers-project-386/commit/b0b470078d371460186b877a44cc7f0af9c7ef00))
* **frontend:** guard остаётся в DOM скрытым, чтобы Chrome не включал secure input ([be0d4f2](https://github.com/AlexPanich/ai-for-developers-project-386/commit/be0d4f2e9c7cf0ed1b2f5636653984f36defbf08)), closes [#33](https://github.com/AlexPanich/ai-for-developers-project-386/issues/33)
* **frontend:** отключить автозаполнение в поле названия типа события ([8178588](https://github.com/AlexPanich/ai-for-developers-project-386/commit/81785885ca1e62b8079165e204d6d5d0ba087322)), closes [#33](https://github.com/AlexPanich/ai-for-developers-project-386/issues/33)
* **frontend:** разворачивать content операции в типе RequestBody ([f8500ab](https://github.com/AlexPanich/ai-for-developers-project-386/commit/f8500ab73e0fc75f38167fcf35de81475daca627))

## [0.3.0](https://github.com/AlexPanich/ai-for-developers-project-386/compare/v0.2.0...v0.3.0) (2026-10-03)


### Features

* **frontend:** add the home page for booking a call ([4f9a7a8](https://github.com/AlexPanich/ai-for-developers-project-386/commit/4f9a7a88437ef3a7f629529bd8bfe22cae85969d))
* **frontend:** route the home page and restyle it ([076e181](https://github.com/AlexPanich/ai-for-developers-project-386/commit/076e181d200a87c65dce8d5bb07bcca40e721a45))

## [0.2.0](https://github.com/AlexPanich/ai-for-developers-project-386/compare/v0.1.0...v0.2.0) (2026-10-03)


### Features

* scaffold monorepo with backend, frontend, lint and tests ([a37809d](https://github.com/AlexPanich/ai-for-developers-project-386/commit/a37809d2cee7cdc5b9858b5acc533c5c1280e66f))
