<script>
    // Восстановление пароля в два шага (события RedAge без изменений):
    //   шаг 0: restorepass(0, логин) → сервер шлёт код на почту → cef.authentication.restoreStep(1)
    //   шаг 1: restorepass(1, код из письма, 6 символов) → вход в аккаунт.
    import { executeClient } from 'api/rage'
    import { onMount, onDestroy } from 'svelte'
    import AuthField from '@/masson/ui/AuthField.svelte'
    import Icon from '@/masson/Icon.svelte'

    export let OnSelectViews;

    let step = 0;          // 0 — логин, 1 — код
    let value = '';
    let error = '';
    let loading = false;
    let timer = null;
    let field;

    const SetStep = (s) => {
        loading = false;
        error = '';
        if (s === 0) { step = 0; value = ''; }
        else if (s === 1) { step = 1; value = ''; }
        setTimeout(() => { if (field) field.focus(); }, 30);
    };

    onMount(() => {
        window.events.addEvent("cef.authentication.restoreStep", SetStep);
    });
    onDestroy(() => {
        window.events.removeEvent("cef.authentication.restoreStep", SetStep);
        if (timer) clearTimeout(timer);
    });

    $: if (value) error = '';

    const submit = () => {
        if (loading) return;
        const v = value.trim();
        if (step === 0) {
            if (!v.length) { error = 'Введите логин'; return; }
            loading = true;
            executeClient('restorepass', 0, v);
        } else {
            if (v.length !== 6) { error = 'Код состоит из 6 символов'; return; }
            loading = true;
            executeClient('restorepass', 1, v);
        }
        value = '';
        timer = setTimeout(() => { loading = false; }, 4000);
    };
</script>

<form class="panel__body stack view" novalidate on:submit|preventDefault={submit}>
    <button type="button" class="btn btn--ghost btn--sm" style="justify-self:start;margin-left:-12px" on:click={() => OnSelectViews("Authentication")}>
        <Icon name="back" />Назад ко входу
    </button>
    <div>
        <h1 class="h2 auth__title">Восстановление пароля</h1>
        <p class="p">{step === 0 ? 'Укажите логин аккаунта, мы отправим код на привязанную почту.' : 'Введите код из письма, чтобы войти в аккаунт.'}</p>
    </div>
    {#if step === 1}
        <div class="alert alert--success"><Icon name="ok" /><span>Письмо с кодом отправлено. Проверьте почту и папку «Спам».</span></div>
    {/if}
    {#key step}
        <AuthField bind:this={field} bind:value={value} {error}
                   label={step === 0 ? 'Логин' : 'Код из письма'}
                   placeholder={step === 0 ? 'Логин аккаунта' : '6 символов'}
                   icon={step === 0 ? 'user' : 'key'} maxlength={step === 0 ? 50 : 6} autofocus={true} />
    {/key}
    <button class="btn btn--primary btn--lg btn--block" class:is-loading={loading} type="submit">{step === 0 ? 'Отправить код' : 'Войти по коду'}</button>
</form>
