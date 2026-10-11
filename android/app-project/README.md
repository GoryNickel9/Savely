# Progetto nativo Savely

Questo progetto apre `https://www.savely.cc/` attraverso Android Browser Helper. Non contiene una copia delle schermate web. Il codice e le dipendenze della web app restano separati dalla build Android.

## Versioni della build

| Componente | Versione |
|---|---|
| Android Gradle Plugin | 8.13.2 |
| Gradle Wrapper | 8.13 |
| Java del codice | 17 |
| JDK per Gradle | 17 o 21 |
| Compile / target SDK | 36 |
| Android minimo | 6.0 / API 23 |
| Android Browser Helper | 2.7.3 |
| Identificatore APK | `cc.savely.android` |

AGP 8.13 richiede Gradle 8.13 e JDK 17 come minimo. Il wrapper verifica il checksum della distribuzione. Il JAR del wrapper è stato confrontato con il checksum ufficiale `81a82aaea5abcc8ff68b3dfcb58b3c3c429378efd98e7433460610fecd7ae45f`.

## Comandi

Eseguire dalla cartella `android/app-project`, con `JAVA_HOME` e `ANDROID_HOME` configurati:

```powershell
.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug
.\gradlew.bat :app:lintRelease :app:assembleRelease
```

La release richiede `SAVELY_ANDROID_KEYSTORE`, `SAVELY_ANDROID_KEYSTORE_PASSWORD`, `SAVELY_ANDROID_KEY_ALIAS` e `SAVELY_ANDROID_KEY_PASSWORD`. Se mancano, la build release fallisce. La chiave e le password devono rimanere fuori dal repository. L'APK debug usa una firma diversa e non soddisfa l'associazione del dominio della release.

Se Gradle lanciato da Codex su Windows fallisce con `Unable to establish loopback connection` e `UnixDomainSockets.connect0`, creare una cartella per i socket fuori dal percorso temporaneo virtualizzato e impostare la proprietà documentata da Java:

```powershell
New-Item -ItemType Directory -Force .gradle/sockets | Out-Null
$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=$((Get-Location).Path)\.gradle\sockets"
```

Questo percorso locale è ignorato da Git. Non modifica JVM di sistema, firewall o sito. [Proprietà Java per socket Unix](https://docs.oracle.com/en/java/javase/21/core/java-networking.html).

Per una versione successiva aggiornare `versionCode` e `versionName` in `android/release.json`, aumentando il codice intero, poi ricostruire:

```powershell
.\gradlew.bat :app:assembleRelease
```

## Apertura e aggiornamenti

`AppEntryActivity` usa una task separata e termina dopo aver avviato `SavelyTwaActivity`. Un tocco sull'icona genera un nuovo URL home con un identificatore casuale pubblico nella query. Il launcher usa la sessione stabile prevista dal costruttore pubblico `TwaLauncher(Context)` e richiede `navigate-existing`. Questo evita di legare la sessione alla task temporanea del launcher, che cambia tra aperture. Il comportamento effettivo di riutilizzo della task e navigazione deve essere verificato con il provider installato; una task già caricata non deve soltanto tornare in primo piano.

I collegamenti verificati a `https://www.savely.cc` conservano percorso, query e frammento. Il dominio senza `www` restituisce un redirect HTTP 308: il manifest registra soltanto il dominio finale, così la verifica dell'associazione non dipende da un redirect. Se un intent esplicito contiene un collegamento storico a `https://savely.cc`, la policy sostituisce solo l'origine con quella canonica e mantiene intatti i parametri e i frammenti, inclusi i token di recupero. La policy rifiuta altri domini, HTTP, credenziali nell'autorità e porte diverse da 443. Non copia gli extra del chiamante e non registra le URL nei log applicativi.

La cache resta gestita dal browser e dalle risposte HTTP del sito. Il nonce non è un'API di hard reload e non può superare un futuro service worker che ignori la query, una cache intermedia configurata male o l'assenza di rete. Il requisito di aggiornamento all'apertura deve essere verificato su un browser Android reale dopo un deploy.

Riaprire la task da **Recenti** riprende la pagina corrente. Tornare da un selettore file o da un browser esterno non forza un ricaricamento. Toccare l'icona mentre si sta compilando un modulo torna alla home; nessuna bozza viene salvata dal codice nativo.

L'associazione Digital Asset Links deve corrispondere alla firma effettiva della release. Se l'associazione fallisce, il browser può mostrare la propria barra. Se manca un browser con supporto TWA, Android Browser Helper usa Custom Tabs o il browser esterno. Nessun WebView è previsto.

## Verifiche

I test JVM verificano origine, rigetto di URL ostili, conservazione dei parametri e URL distinte per le aperture dall'icona. Un test di regressione verifica anche la registrazione di `ManageDataLauncherActivity`: Browser Helper ne modifica lo stato all'avvio e Android termina l'app se manca nel manifest. Non verificano la gestione delle task o la cache di Chrome: quelle richiedono test sul dispositivo, descritti nella documentazione Android generale.

La build usa le icone esistenti in `public`; le copie presenti nelle risorse native non richiedono modifiche agli originali.

## Fonti

- [Android Browser Helper 2.7.3](https://github.com/GoogleChrome/android-browser-helper/releases/tag/android-browser-helper-2.7.3)
- [LauncherActivity della release utilizzata](https://github.com/GoogleChrome/android-browser-helper/blob/android-browser-helper-2.7.3/androidbrowserhelper/src/main/java/com/google/androidbrowserhelper/trusted/LauncherActivity.java)
- [Compatibilità AGP 8.13](https://developer.android.com/build/releases/agp-8-13-0-release-notes)
- [Verifica Gradle Wrapper](https://docs.gradle.org/8.13/userguide/gradle_wrapper.html#sec:verification)
- [Trusted Web Activities](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities)
