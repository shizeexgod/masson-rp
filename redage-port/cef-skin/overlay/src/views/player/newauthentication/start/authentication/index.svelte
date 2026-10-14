<script>
    // Вход. События RedAge без изменений: client:OnSignInv2(login, password).
    import { executeClient } from 'api/rage'
    import { accountLogin, accountIsSession } from 'store/account'
    import { onMount, onDestroy } from 'svelte'
    import AuthField from '@/masson/ui/AuthField.svelte'

    export let OnSelectViews;

    let login = '', password = '';
    let errLogin = '', errPass = '';
    let loading = false;
    let loginField;
    let passField;
    let timer = null;

    // Логин известен с сервера (аккаунт Social Club уже есть) — подставляем и фокусируем пароль.
    const unsub = accountLogin.subscribe((value) => {
        if (value == -99 || value == -1 || value == "-1") return;
        login = String(value);
        setTimeout(() => { if (passField) passField.focus(); }, 50);
    });
    onDestroy(() => { unsub(); if (timer) clearTimeout(timer); });
    onMount(() => { if (!login && loginField) loginField.focus(); });

    $: if (login) errLogin = '';
    $: if (password) errPass = '';

    const submit = () => {
        if (loading) return;
        errLogin = login.trim() ? '' : 'Введите логин или почту';
        errPass = password ? '' : 'Введите пароль';
        if (errLogin || errPass) return;
        if ($accountIsSession || $accountLogin === -99) return;
        loading = true;
        executeClient("client:OnSignInv2", login.trim(), password);
        // Ответ приходит уведомлением игры; кнопка не должна оставаться заблокированной навсегда.
        timer = setTimeout(() => { loading = false; }, 2500);
    };
</script>

<form class="panel__body stack view" novalidate on:submit|preventDefault={submit}>
    <div>
        <h1 class="h2 auth__title">С возвращением</h1>
        <p class="p">Войдите в аккаунт, чтобы продолжить игру.</p>
    </div>
    <AuthField bind:this={loginField} bind:value={login} error={errLogin} label="Логин или почта" placeholder="Ваш логин" icon="user" autocomplete="username" maxlength={64} />
    <AuthField bind:this={passField} bind:value={password} error={errPass} label="Пароль" type="password" placeholder="Ваш пароль" icon="lock" autocomplete="current-password" maxlength={64} />
    <div class="auth__links">
        <span></span>
        <button type="button" class="link" on:click={() => OnSelectViews("Restore")}>Забыли пароль?</button>
    </div>
    <button class="btn btn--primary btn--lg btn--block" class:is-loading={loading} type="submit">Войти</button>
</form>
