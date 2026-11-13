# Bebek Ejderha · Baby Dragon

**Türkçe** · [English](#english)

Bu oyun oğlumun oyunu. Ben yalnızca ufak tefek yardım ettim.

Oyunu "vibe coding" ile yaptık: Oğlum ne istediğini çoğu zaman Claude Code'a kendisi söyledi, kodu da Claude Opus 5.5 yazdı. Ejderhanın yılan gibi ince ve kıvrak olmasına, kötü sihirbazın bıyıklı ama kesinlikle sakalsız olmasına o karar verdi. Her yeni hâlini oynayıp bozuk yerleri de çoğu zaman o yakaladı. Mesela ejderha suya dalınca kartalların da peşinden suyun içine girdiğini o fark etti.

## Hikâye

Kötü Sihirbaz, bebek ejderhayı yumurtadan çıktığı gün kaçırmış. Onu sirkinde gösteriye çıkarıp çok para kazanmış. Ama bir gece kafesin kapısı açık kalıyor! Ejderha sirkten kaçıyor ve Ejderha Dağı'nda bekleyen annesine ulaşmaya çalışıyor. Sihirbazın adamları, robotları ve hayvanları da peşinde.

Ejderha ateş püskürüyor, uçuyor, suyun dibine dalıyor ve toprağı kazıp yerin altından gidiyor. Kovalayanları ateşle sersemletiyor, attıkları ağları da ateşle yakıp kurtuluyor.

## Bölümler

Oyun Ana Sayfa'da başlıyor. Her bölümün orada bir gökkuşağı kapısı var. Her bölüm de bir gökkuşağı kapısında bitiyor, ejderha da sisin içinden uçup bir sonraki bölüme süzülüyor.

- **Sirkten Kaçış:** Sirk çadırları, bekçiler ve bir sirk ayısı. Çiti ya üstünden uçarak ya da altından kazarak geçmek gerekiyor.
- **Büyük Göl:** Ormanın ortasında derin bir göl. Dibinde yosunlar, balıklar ve bir hazine sandığı var.
- **Karlı Tepeler:** Kardan adamlar, penguenler ve kurtlar. Kartallar ejderhayı havada da kovalıyor.
- **Kumlu Çöl:** Kaktüsler, palmiyeli bir vaha ve akrepler.
- **Bataklık:** Dev mantarlar, kurbağalar ve nilüferler. Sudaki timsahların başını ancak baloncuklar döndürüyor. Sonunda Kötü Sihirbaz'ın kampı var.
- **Ejderha Dağı:** Lav gölleri ve sihirbazın son kampı. Sonunda anne ejderha bekliyor.
- **Sürpriz Kapısı:** Her seferinde yepyeni bir bölüme açılıyor, "Pembe Bataklık" ya da "Mor Çöl" gibi. Sürpriz bölümler hiç bitmiyor, her biri bir öncekinden biraz daha zor.

Bölümlerde çiti ya uçarak ya kazarak, duvarı ancak altından kazarak, nehri de dalarak geçmek gerekiyor.

## Nasıl oynanır?

`index.html` dosyasına çift tıklamanız yeterli, bir şey kurmanıza gerek yok. Oyun açılan bölümleri tarayıcıya kaydediyor.

| Tuş | Ne işe yarar? |
| --- | --- |
| W A S D / oklar | Yürür ve döner |
| Boşluk | Zıplar; basılı tutunca uçar |
| F / tıklama | Ateş püskürür; ağa yakalanınca hızlı hızlı basılır |
| E | Karada toprağı kazar, suda dibe dalar; bir daha basınca yukarı çıkar |
| Q | Koşmayı açar, kapatır |
| Shift | Suda aşağı iner, havada hızlı alçalır |
| H | Ana Sayfa'ya döner |
| M | Müziği açar, kapatır |
| P / Esc | Oyunu durdurur |
| Home | Ekran düğmelerini açar, kapatır |
| O (hile) | Bölümü hemen bitirir |

Fare olmayan cihazlarda ekran düğmeleri kendiliğinden çıkıyor. Farenin de olduğu cihazlarda ise ekrana ilk dokunuşta açılıyor.

## Kod

Düz JavaScript ve [Three.js](https://threejs.org) kullanıldı, derlemeye gerek yok. Ses dosyası da yok; bütün sesleri ve müziği kod üretiyor.

- `js/levels.js`: Ana Sayfa, bölümler ve sürpriz bölüm üreticisi. Her bölüm sırayla dizilen parçalardan oluşur: sirk, çayır, orman, kayalık, nehir, göl, çit, duvar, kamp.
- `js/world.js`: Bir bölümü parçalarından ve ortamından kurar.
- `js/models.js`: Ejderha, sihirbaz, kovalayanlar, zararsız hayvanlar ve dekor.
- `js/dragon.js`: Ejderhanın yürümesi, uçması, yüzmesi, kazması ve ateşi.
- `js/enemies.js`: Kovalayanlar (yürüyenler, uçan kartal, yüzen timsah) ve attıkları ağlar.
- `js/critters.js`: Balık, kuş, tavşan, geyik, penguen ve kurbağa.
- `js/crossing.js`: Bölümler arasındaki geçiş animasyonu.
- `js/audio.js`: Ses efektleri ve müzik.
- `js/touch.js`: Fare olmadan oynamak için ekran düğmeleri.
- `js/game.js`: Oyunun kuralları, kontroller, kamera ve ekran.
- `js/utils.js`: Dünya kuralları, arazi yüksekliği ve küçük yardımcılar.
- `vendor/three.min.js`: Three.js 0.187.0. Çift tıklayınca çalışsın diye esbuild ile tek dosyada paketlendi (`export * from 'three'`, `--bundle --minify --format=iife --global-name=THREE`).

---

<a id="english"></a>

# English

[Türkçe](#bebek-ejderha--baby-dragon) · **English**

This is my son's game. I only helped out a little.

We vibe-coded it: most of the time my son told Claude Code what he wanted himself, and Claude Opus 5.5 wrote the code. He decided that the dragon should be slim and wriggle like a snake, and that the evil wizard has a moustache but definitely no beard. He played each new version and often caught what was broken, like eagles following the dragon underwater.

## The story

The Evil Wizard stole the baby dragon the day it hatched and made a fortune showing it off in his circus. One night the cage door is left open! The dragon escapes the circus and heads for Dragon Mountain, where its mother is waiting, with the wizard's men, robots and animals on its tail.

The dragon breathes fire, flies, dives to the bottom of the water and digs under the ground. Fire stuns the chasers and burns away the nets they throw.

## The levels

The game starts on the home meadow, which has a rainbow door for each level. Every level ends at a rainbow gate, and the dragon flies off through the mist and glides down into the next one. The in-game names are Turkish:

- **Sirkten Kaçış (Circus Escape):** circus tents, guards and a circus bear; fly over the fence or dig under it
- **Büyük Göl (Big Lake):** a deep lake in a forest, with seaweed, fish and a treasure chest at the bottom
- **Karlı Tepeler (Snowy Hills):** snowmen, penguins and wolves, and eagles that chase the dragon in the air
- **Kumlu Çöl (Sandy Desert):** cacti, an oasis with palm trees, and scorpions
- **Bataklık (Swamp):** giant mushrooms, frogs and water lilies; only bubbles can make the crocodiles dizzy; the Evil Wizard's camp is at the end
- **Ejderha Dağı (Dragon Mountain):** lava pools and the wizard's last camp, with the mother dragon waiting at the end
- **Sürpriz Kapısı (Surprise Door):** opens onto a brand-new level every time, like "Pink Swamp" or "Purple Desert"; they never run out, and each is a little harder than the one before

Fences can be flown over or dug under, walls only dug under, and rivers dived through.

## Playing

Double-click `index.html`. There is nothing to install. The game's text is in Turkish. It saves the levels you have opened in the browser.

| Key | What it does |
| --- | --- |
| W A S D / arrows | Walk and turn |
| Space | Jump; hold to fly |
| F / click | Breathe fire; tap fast to burn your way out of a net |
| E | Dig into the ground, or dive to the bottom of the water; again to come back up |
| Q | Running on or off |
| Shift | Sink in the water, drop faster in the air |
| H | Back to the home meadow |
| M | Music on or off |
| P / Esc | Pause |
| Home | Show or hide the on-screen buttons |
| O (cheat) | Finishes the level at once |

On-screen buttons appear by themselves on devices without a mouse. On devices that also have a mouse, they appear at the first touch.

## The code

Plain JavaScript and [Three.js](https://threejs.org), with no build step. Sounds and music are generated by code rather than loaded from files. The list of files is in the [Turkish section](#kod).
