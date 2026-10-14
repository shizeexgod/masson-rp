<script>
    // Экран входа Masson RP: бренд, арт, панель «Вход / Регистрация / Восстановление».
    // Какая вкладка доступна, решает сервер через accountLogin (-1 — для Social Club ещё нет аккаунта → регистрация).
    import Authentication from './authentication/index.svelte';
    import Registration from './registration/index.svelte';
    import Restore from './restore/index.svelte';
    import { accountLogin } from 'store/account'
    import { isSend } from '@/views/player/newauthentication/store.js';
    import { addListernEvent } from 'api/functions'
    import Icon from '@/masson/Icon.svelte'
    import markImg from '@/masson/img/masson-mark-256.png'
    import heroImg from '@/masson/img/art-wide.jpg'

    const Views = { Authentication, Registration, Restore };

    let SelectViews = "Authentication";
    let canLogin = true;
    let canRegister = false;

    accountLogin.subscribe((value) => {
        if (value == -99) return;
        if (value == -1 || value == "-1") {
            SelectViews = "Registration";
            canLogin = false;
            canRegister = true;
        } else {
            SelectViews = "Authentication";
            canLogin = true;
            canRegister = false;
        }
    });

    const OnSelectViews = (view) => {
        if (SelectViews === view) return;
        if (view === "Authentication" && !canLogin) return;
        if (view === "Registration" && !canRegister) return;
        SelectViews = view;
    };

    addListernEvent("isSendEmailMessage", (toggled) => {
        isSend.set(toggled)
    })
</script>

<div class="scr">
    <div class="scr__bg"></div>
    <div class="scr__vignette"></div>

    <div class="auth__brand">
        <img src={markImg} alt="" style="width:64px"><b>Masson RP</b>
    </div>
    <img class="auth__hero" src={heroImg} alt="Masson RP">

    <main class="auth__panel panel">
        {#if SelectViews !== "Restore"}
            <div class="panel__head" style="padding:0">
                <div class="tabs" role="tablist" style="margin-top:8px">
                    <button class="tab" class:is-active={SelectViews === "Authentication"} class:is-disabled={!canLogin} role="tab"
                            aria-selected={SelectViews === "Authentication"} aria-disabled={!canLogin}
                            title={canLogin ? '' : 'Для вашего Social Club аккаунт ещё не создан'}
                            on:click={() => OnSelectViews("Authentication")}>Вход</button>
                    <button class="tab" class:is-active={SelectViews === "Registration"} class:is-disabled={!canRegister} role="tab"
                            aria-selected={SelectViews === "Registration"} aria-disabled={!canRegister}
                            title={canRegister ? '' : 'Аккаунт уже создан — войдите в него'}
                            on:click={() => OnSelectViews("Registration")}>Регистрация</button>
                </div>
            </div>
        {/if}
        {#key SelectViews}
            <svelte:component this={Views[SelectViews]} OnSelectViews={OnSelectViews} />
        {/key}
    </main>

    <footer class="auth__foot"><span></span><span>Masson RP</span></footer>
</div>

{#if $isSend}
    <div class="scrim">
        <div class="modal panel" role="alertdialog" aria-modal="true">
            <div class="modal__ico"><Icon name="mail" /></div>
            <h2 class="h2">Мы отправили письмо на вашу почту</h2>
            <p class="p" style="margin-top:8px">Подтвердите адрес электронной почты, чтобы перейти к созданию персонажа.</p>
            <div class="modal__actions"><button class="btn" on:click={() => isSend.set(false)}>Я перепутал почту</button></div>
        </div>
    </div>
{/if}
