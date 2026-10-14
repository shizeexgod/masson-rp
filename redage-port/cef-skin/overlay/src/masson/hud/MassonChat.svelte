<script>
    // Чат Masson RP. Логика RedAge сохранена: window.chat {updateConfig, toggleInput, addMessage}, события chat:push,
    // отправка через invokeMethod("chatMessage"/"command"), каналы IC/OOC/ME/DO/TRY/REP (Tab), буфер отправленных (↑/↓).
    import { translateText } from 'lang'
    import moment from 'moment';
    import { executeClient, invokeMethod } from 'api/rage'
    import Commands from 'json/commands.js'
    import { format } from 'api/formatter'
    import { isInputToggled, isHelp } from 'store/hud'

    const ChatTegs = [
        { name: "IC",  chat: false,    visible: true },
        { name: "OOC", chat: "b",      visible: true },
        { name: "ME",  chat: "me",     visible: true },
        { name: "DO",  chat: "do",     visible: true },
        { name: "TRY", chat: "try",    visible: true },
        { name: "REP", chat: "report", visible: true },
    ];
    let selectChat = 0;

    let TextInput;
    let Messages = [];
    let InputValue = "";
    let savedInput = "";
    let bufferState = -1;
    let bufferCurrent = "";
    let buffer = [];

    // затухание сообщений, пока чат не используется
    let timerId = 0;
    let noActive = false;

    const AddChatMessage = (text) => {
        text = format("parse", text);
        if (Messages.length > 50) Messages.pop();
        const generatedMessage = getColorizedMessagePart(text);
        Messages = [{ time: moment().format('HH:mm:ss'), parts: generatedMessage }, ...Messages];
        onActive();
    };

    const onActive = () => {
        if ($isInputToggled) return;
        noActive = false;
        if (timerId) clearTimeout(timerId);
        timerId = setTimeout(ClearData, 15000);
    };
    const ClearData = () => { timerId = 0; noActive = true; };

    const parseMessage = (text) => {
        const re = new RegExp('!{((#[0-9a-f]{3})|(#[0-9a-f]{6})|([0-9a-f]{3})|([0-9a-f]{6})|(\\w+))}', 'i');
        const match = re.exec(text);
        if (!match) return null;
        let color = match[1];
        color = color ? `${color.startsWith('#')
            ? color
            : /(^[0-9A-Fa-f]{6}$)|(^[0-9A-Fa-f]{3}$)/i.test(color) ? '#' + color : color}` : null;
        return { color, index: match.index, remainingText: text.slice(match.index + match[0].length) };
    };

    const getColorizedMessagePart = (text) => {
        const parts = [];
        let prevColor = null;
        let currentText = text;
        let message;
        let attempts = 0;
        for (; (message = parseMessage(currentText)) || !attempts;) {
            const prevText = currentText.slice(0, message ? message.index : currentText.length);
            if (prevText.length) {
                parts.push({ color: prevColor, text: prevText.replace(/\\!{/g, '!{').replace(/\\}/g, '}') });
            }
            if (message) { prevColor = message.color; currentText = message.remainingText; }
            else attempts++;
        }
        return parts;
    };

    const ToggleChatInput = (state, clearchat = false, updatelastbuffer = false, event = false) => {
        if (state) {
            noActive = false;
            if (timerId) clearTimeout(timerId);
            window.hudStore.isInputToggled(true);
            timerId = 0;
            setTimeout(() => {
                if (TextInput) {
                    TextInput.focus();
                    if (bufferState === -1) {
                        InputValue = savedInput;
                        SetInputFocused();
                    } else {
                        InputValue = buffer[bufferState] !== undefined ? buffer[bufferState] : "";
                        SetInputFocused();
                    }
                    if (event) executeClient("client:OnChatInputChanged", true);
                }
            }, 0);
        } else {
            bufferCurrent = clearchat ? "" : (updatelastbuffer ? InputValue : bufferCurrent);
            bufferState = clearchat ? -1 : bufferState;
            savedInput = clearchat ? "" : InputValue;
            window.hudStore.isInputToggled(false);
            onActive();
            InputValue = "";
            if (event) executeClient("client:OnChatInputChanged", false);
        }
    };

    const OnSubmitMessage = () => {
        bufferState = -1;
        bufferCurrent = "";

        if (InputValue) {
            if (buffer.length > 50) buffer.shift();
            // не сохраняем одинаковые сообщения подряд
            if (buffer[buffer.length - 1] !== InputValue) buffer.push(InputValue);

            if (InputValue[0] === '/') {
                let commandText = InputValue.trim().substr(1);
                if (commandText.length > 0) {
                    let params = commandText.split(' ');
                    let command = params[0];
                    params.shift();
                    switch (command) {
                        case "widthsize":
                        case "pagesize":
                        case "fontsize":
                        case "timestamp":
                        case "chatalpha":
                            window.notificationAdd(4, 9, translateText('player2', 'Данная функция была перенесена в настройки, найти их вы можете нажав на клавишу F10'), 3000);
                            break;
                        case "weatherinfo": executeClient("weatherinfo"); break;
                        case "restartopen": executeClient("restart.open"); break;
                        case "greenzone": executeClient("greenzone"); break;
                        case "cltest": executeClient("test.test"); break;
                        default:
                            commandText = format("parseDell", commandText);
                            if (commandText.length > 0) invokeMethod("command", commandText);
                            break;
                    }
                }
            } else {
                let message = format("stringify", InputValue);
                if (message.length > 0) {
                    if (selectChat === 0) invokeMethod("chatMessage", message);
                    else {
                        const commandText = `${ChatTegs[selectChat].chat} ${message}`;
                        if (commandText.length > 0) invokeMethod("command", commandText);
                    }
                }
            }
        }
        ToggleChatInput(false, true, true, true);
    };

    const SetInputFocused = () => {
        if (TextInput) {
            TextInput.focus();
            TextInput.selectionStart = InputValue.length;
        }
    };

    const handleKeyUp = (e) => {
        if ($isInputToggled && e.keyCode === 13) OnSubmitMessage();
    };

    const handleKeyDown = (event) => {
        if (!$isInputToggled) return;
        switch (event.keyCode) {
            case 9: // Tab — следующий канал
                event.preventDefault();
                if (++selectChat >= ChatTegs.length) selectChat = 0;
                break;
            case 38: // ↑ — буфер вверх
                event.preventDefault();
                if (bufferState === -1) { bufferState = buffer.length - 1; bufferCurrent = InputValue; }
                else if (bufferState > 0) { bufferState = bufferState - 1; SetInputFocused(); }
                else { SetInputFocused(); break; }
                if (buffer[bufferState]) { InputValue = buffer[bufferState]; SetInputFocused(); }
                break;
            case 40: // ↓ — буфер вниз
                event.preventDefault();
                if (bufferState === -1) break;
                if (bufferState < buffer.length - 1) { bufferState = bufferState + 1; SetInputFocused(); }
                else { InputValue = bufferCurrent; bufferState = -1; bufferCurrent = ""; SetInputFocused(); break; }
                if (buffer[bufferState] !== undefined) { InputValue = buffer[bufferState]; SetInputFocused(); }
                break;
            default: break;
        }
    };

    // настройки чата из меню игры
    let Alpha = 100, Transition = 0, TimeStamp = true, PageSize = 6, WidthSize = 50, FontSize = 14, chatShadow = false;

    window.chat = {
        updateConfig: (config) => {
            config = JSON.parse(config);
            TimeStamp = config["Timestamp"];
            PageSize = config["Pagesize"];
            Alpha = config["ChatOpacity"];
            Transition = config["Transition"];
            FontSize = config["Fontsize"];
            WidthSize = config["Widthsize"];
            chatShadow = config["ChatShadow"];
        },
        toggleInput: (toggled, clearchat = false, updatelastbuffer = false, event = false) => {
            ToggleChatInput(toggled, clearchat, updatelastbuffer, event);
        },
        addMessage: (message, clearhtml = true) => {
            AddChatMessage(message);
        },
    };
    if (window.mp && window.mp.events) {
        window.mp.events.add("chat:push", (message) => AddChatMessage(message));
    }

    $: lines = Messages.slice(0, Math.max(1, PageSize)).reverse();     // старые сверху, новые снизу
    $: width = Math.max(320, Math.round(500 * (WidthSize / 50)));
    $: suggestions = ($isHelp && InputValue && InputValue.length >= 1)
        ? Commands.filter(item => item.cmd.indexOf(InputValue) != -1 && item.cmd.indexOf("/") != -1).slice(0, 6) : [];
</script>

<svelte:window on:keyup={handleKeyUp} on:keydown={handleKeyDown} />

<section class="chat" class:is-open={$isInputToggled} aria-label="Чат"
         style="width:{width}px;font-size:{FontSize}px;opacity:{!noActive || $isInputToggled ? 1 : Alpha / 100};transition:opacity {Transition / 100}s">
    <div class="chat__log">
        {#each lines as msg}
            <div class="msg msg--general" class:oldshadow={chatShadow}>
                {#if TimeStamp}<time>{msg.time}</time>{/if}
                {#each msg.parts as part}<span style={part.color ? 'color:' + part.color : ''}>{@html part.text}</span>{/each}
            </div>
        {/each}
    </div>

    {#if $isInputToggled}
        <div class="chat__box">
            <div class="chat__field is-interactive">
                <span class="chat__chan">{ChatTegs[selectChat].name}</span>
                <input class="chat__input" bind:this={TextInput} spellcheck="false" maxlength="144" placeholder="Введите сообщение" bind:value={InputValue} />
                <span class="chat__count">{InputValue.length}/144</span>
            </div>
            {#if suggestions.length}
                <div class="chat__sug">
                    {#each suggestions as item}
                        <div class="sug"><b>{item.cmd}</b><span>{item.descr}</span></div>
                    {/each}
                </div>
            {/if}
            <div class="chat__keys is-interactive">
                <span><i class="key">Tab</i>канал</span>
                {#each ChatTegs as tag, index}
                    {#if tag.visible}
                        <button class="chat__tag" class:is-active={index === selectChat} on:click={() => selectChat = index}>{tag.name}</button>
                    {/if}
                {/each}
            </div>
        </div>
    {/if}
</section>

<style>
    :global(.mp .hud .chat__input) { flex: 1; min-width: 0; height: 100%; background: transparent; border: 0; outline: none; color: var(--text);
        font-family: inherit; font-size: var(--fs-sm); font-weight: var(--fw-semibold); pointer-events: auto; }
    :global(.mp .hud .chat__input::placeholder) { color: var(--text-dim); }
    :global(.mp .hud .chat__tag) { font-family: inherit; font-size: 10px; font-weight: 700; letter-spacing: .04em; color: var(--text-muted); background: rgba(255,255,255,.07);
        border: 0; border-radius: 4px; padding: 2px 7px; cursor: pointer; pointer-events: auto; }
    :global(.mp .hud .chat__tag.is-active) { background: var(--accent-gradient); color: #fff; }
    :global(.mp .hud .chat__log .msg) { opacity: 1; transition: opacity .2s; }
    :global(.mp .hud .chat__keys) { align-items: center; }
    :global(.mp .hud .chat__field) { pointer-events: auto; }
</style>
