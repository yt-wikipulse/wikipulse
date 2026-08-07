# Работа с кластером YTsaurus: настройка окружения и запуск джоб

## 1. Доступы

Запросите у куратора логин, пароль и токен. Токен нужен для консоли и кода,
логин с паролем — для веб-интерфейса.

Директория вашей команды одна из: `//home/wikipulse`,
`//home/wikipulse`, `//home/wikipulse`.

## 2. Python

Нужен **Python 3.11 или 3.12**. Проверьте, что у вас:

    python3 -V

Если версия ниже 3.11:

| Система | Команда |
|---|---|
| macOS | `brew install python@3.12` |
| Ubuntu / Debian | `sudo apt install python3.12 python3.12-venv` |
| Windows | `winget install Python.Python.3.12` |

На маках из коробки обычно стоит 3.9, так что этот шаг почти наверняка нужен.

## 3. Java

Нужна **Java 17 или новее**. Проверьте:

    java -version

Если Java нет или она старше:

| Система | Команда |
|---|---|
| macOS | `brew install openjdk@17` |
| Ubuntu / Debian | `sudo apt install openjdk-17-jdk` |
| Windows | `winget install Microsoft.OpenJDK.17` |

На macOS Homebrew не подключает Java к системе автоматически, поэтому нужен
ещё один шаг:

    sudo ln -sfn $(brew --prefix openjdk@17)/libexec/openjdk.jdk \
      /Library/Java/JavaVirtualMachines/openjdk-17.jdk

После этого `java -version` должна показать 17.

## 4. Клиент YTsaurus и SPYT

**macOS и Linux:**

    python3.12 -m venv ~/spyt-summer-school
    source ~/spyt-summer-school/bin/activate

**Windows (PowerShell):**

    py -3.12 -m venv $HOME\spyt-summer-school
    $HOME\spyt-summer-school\Scripts\Activate.ps1

Дальше одинаково:

    pip install --upgrade pip
    pip install ytsaurus-client ytsaurus-spyt==2.11.0 pyspark==4.2.0

Проверка:

    python -V
    yt --version

## 5. Адрес прокси

Временная особенность нашего кластера: он сообщает клиенту внутренний адрес,
который снаружи не разрешается. Пропишите его вручную, один раз на машину.

**macOS и Linux:**

    echo "203.0.113.10 rpc-proxy.example.com" | sudo tee -a /etc/hosts

**Windows** (PowerShell от имени администратора):

    Add-Content -Path $env:WINDIR\System32\drivers\etc\hosts `
      -Value "203.0.113.10 rpc-proxy.example.com"

Проверка (везде одинаково):

    python3 -c "import socket; print(socket.getaddrinfo('rpc-proxy.example.com', 9013)[0][4][0])"

Должно напечатать `203.0.113.10`.

## 6. Файл для быстрого входа

Чтобы не вводить настройки каждый раз, сохраните их в файл.

**macOS и Linux** — файл `~/a-summer-school`:

    source ~/spyt-summer-school/bin/activate
    export YT_PROXY=https://your-cluster.example.com/
    export YT_TOKEN=<ваш токен>
    source spyt-env

Перед работой:

    source ~/a-summer-school

**Windows (PowerShell)** — файл `$HOME\a-summer-school.ps1`:

    & $HOME\spyt-summer-school\Scripts\Activate.ps1
    $env:YT_PROXY = "https://your-cluster.example.com/"
    $env:YT_TOKEN = "<ваш токен>"
    $env:SPARK_CONF_DIR = (python -c "import spyt, os; print(os.path.join(spyt.__path__[0], 'conf'))")

Перед работой:

    . $HOME\a-summer-school.ps1

Последняя строка в обоих вариантах делает одно и то же — включает конфигурацию
SPYT. Без неё `spark-submit` не понимает адрес кластера и падает с сообщением
про master.

Токен никуда не публикуйте: не коммитьте в репозиторий и не вставляйте в код.

## 7. Проверка доступа

    yt whoami
    yt list //home/wikipulse

Первая команда покажет вашего пользователя, вторая — список команд.

## 8. Первая джоба

Готовый пример уже лежит на кластере, создавать ничего не нужно. Подставьте
свою команду в последний аргумент и запустите:

    spark-submit \
      --master ytsaurus://https://your-cluster.example.com \
      --deploy-mode cluster \
      --num-executors 1 \
      --conf spark.pyspark.python=/usr/bin/python3.11 \
      --py-files yt:///home/wikipulse/lib/spyt_deps.zip \
      yt:///home/example/hello.py //home/wikipulse/<ваша команда>/result

В логе появится ссылка на операцию — по ней удобно смотреть статус и логи
в веб-интерфейсе.

Проверьте результат:

    yt read-table //home/wikipulse/<ваша команда>/result --format json

Ожидаемый вывод:

    {"id":1,"text":"hello"}
    {"id":2,"text":"world"}
    {"id":3,"text":"spyt"}

## Почему в команде запуска лишние параметры

`--conf spark.pyspark.python` и `--py-files` нужны из-за особенностей нашего
кластера: на его вычислительных узлах по умолчанию стоит слишком старый Python,
а часть библиотек не установлена, поэтому мы указываем нужную версию и
привозим библиотеки с собой. Когда это поправят, команда станет короче.

## Если что-то не работает

**`Unable to locate a Java Runtime`** — не установлена Java, см. пункт 3.

**`Master must either be yarn or start with spark, k8s, or local`** — не выполнен
вход из пункта 6 в текущем терминале.

**Клиент долго висит и падает на подключении** — не прописан адрес прокси,
см. пункт 5.

**`Unicode symbols with codes greater than 255 are not supported`** — при работе
с JSON-форматом добавьте опцию `encode_utf8=false`, иначе не пройдут строки
с кириллицей.