# Android — Guia de Build

## O que está versionado nesta pasta

| Tipo | O que é | Por quê está no git |
|---|---|---|
| `app/build.gradle` | applicationId, versionCode, versionName, SDKs | Identidade e versionamento do app |
| `build.gradle` | Gradle plugin version, Google Services | Configuração do sistema de build |
| `settings.gradle` / `capacitor.settings.gradle` | Estrutura do projeto | Necessário para build |
| `gradle.properties` | Flags do Gradle | Configuração de ambiente |
| `gradle/wrapper/gradle-wrapper.properties` | Versão do Gradle | Garante build reproduzível |
| `gradlew` / `gradlew.bat` | Scripts do Gradle | Permite build sem Android Studio |
| `app/src/main/AndroidManifest.xml` | Permissões, providers, activity | Estrutura do app |
| `app/src/main/java/.../MainActivity.java` | Entry point do app | Código nativo |
| `app/src/main/res/values/strings.xml` | Nome do app, package name | Identidade |
| `app/src/main/res/values/styles.xml` | Temas, status bar | Aparência |
| `app/src/main/res/values/colors.xml` | Paleta de cores | Aparência |
| `app/src/main/res/mipmap-*/` | Ícones do launcher (5 densidades) | Assets do app |
| `app/src/main/res/drawable*/splash.png` | Telas de splash (portrait + landscape) | Assets do app |
| `app/src/main/res/drawable*/ic_launcher*.xml` | Ícone adaptativo (API 26+) | Assets do app |
| `app/src/main/res/xml/file_paths.xml` | Paths do FileProvider | Necessário para compartilhamento |
| `app/proguard-rules.pro` | Regras de ofuscação | Configuração de release |
| `.gitignore` | Exclusões de build | Mantém o repo limpo |

---

## O que NÃO está no git (e por quê)

| Arquivo/Pasta | Por quê está fora |
|---|---|
| `local.properties` | Contém caminho do SDK local (específico da máquina) |
| `gradle/wrapper/gradle-wrapper.jar` | Binário — pode ser baixado automaticamente |
| `app/release/` | Contém AABs assinados — nunca commitar builds ou keystores |
| `app/build/`, `build/`, `.gradle/` | Gerado em cada build — lixo de compilação |
| `.idea/` | Configurações do Android Studio — específicas do ambiente |
| `app/src/main/assets/public/` | Gerado por `npx cap sync` — espelha `www/` |
| `app/src/main/assets/capacitor.config.json` | Gerado por `npx cap sync` |
| `app/src/main/assets/capacitor.plugins.json` | Gerado por `npx cap sync` |
| `app/src/main/res/xml/config.xml` | Gerado por `npx cap sync` |
| `capacitor-cordova-android-plugins/` | Gerado por `npx cap sync` |

---

## Como reproduzir o ambiente Android do zero

### Pré-requisitos
- Node.js 18+
- Android Studio com SDK instalado
- Java 17+
- `local.properties` criado manualmente com o caminho do SDK:
  ```
  sdk.dir=/caminho/para/Android/Sdk
  ```

### Passos

```bash
# 1. Instalar dependências
npm install --legacy-peer-deps

# 2. Gerar assets web para www/
npm run build:mobile

# 3. Sincronizar web → Android (copia assets, regenera configs)
npx cap sync android

# 4. Gerar AAB de release (requer keystore configurada)
cd android
./gradlew bundleRelease
```

O AAB será gerado em: `android/app/build/outputs/bundle/release/app-release.aab`

> Não usar `android/app/release/app-release.aab` — essa pasta não é rastreada e pode conter builds desatualizados.

---

## Keystore

A keystore para assinar o app em produção **não está no repositório** e não deve ser commitada nunca.

- Guarde a keystore em local seguro (ex: gerenciador de senhas, Google Drive criptografado)
- Para gerar um AAB assinado localmente, configure `android/app/build.gradle` ou use Android Studio > Build > Generate Signed Bundle

---

## Identidade atual do app

| Campo | Valor |
|---|---|
| applicationId | `com.minharotarp.app` |
| Nome | Minha Rota RP |
| versionCode | 70 |
| versionName | 1.0 |
| minSdkVersion | 22 (Android 5.1) |
| targetSdkVersion | 35 (Android 15) |

---

## Configurações que dependem de `npx cap sync`

Estes arquivos são **gerados automaticamente** e não estão no git.
Após qualquer mudança no web ou no `capacitor.config.json`, rode:

```bash
npm run build:mobile && npx cap sync android
```

Isso atualiza:
- `app/src/main/assets/public/` (cópia do `www/`)
- `app/src/main/assets/capacitor.config.json`
- `app/src/main/assets/capacitor.plugins.json`
- `app/src/main/res/xml/config.xml`
