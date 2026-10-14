<script>
    // Регистрация. События RedAge без изменений: client:OnSignUpv2(login, email, promo, pass1, pass2).
    // Проверки зеркалят клиентские правила игры (логин 3–32: латиница и цифры, почта, пароль от 3 символов, совпадение).
    import { executeClient } from 'api/rage'
    import { accountLogin } from 'store/account'
    import { onMount, onDestroy } from 'svelte'
    import AuthField from '@/masson/ui/AuthField.svelte'

    let login = '', email = '', pass1 = '', pass2 = '', promo = '';
    let eLogin = '', eEmail = '', ePass1 = '', ePass2 = '';
    let loading = false;
    let timer = null;
    let first;

    onMount(() => { if (first) first.focus(); });
    onDestroy(() => { if (timer) clearTimeout(timer); });

    $: if (login) eLogin = '';
    $: if (email) eEmail = '';
    $: if (pass1) ePass1 = '';
    $: if (pass2) ePass2 = '';

    const strength = (p) => {
        let s = 0;
        if (p.length >= 3) s = 1;
        if (p.length >= 6) s = 2;
        if (p.length >= 8 && /[A-Za-zА-Яа-я]/.test(p) && /\d/.test(p)) s = 3;
        if (p.length >= 10 && /[A-ZА-Я]/.test(p) && /[a-zа-я]/.test(p) && /\d/.test(p)) s = 4;
        return s;
    };
    $: s = strength(pass1);

    const submit = () => {
        if (loading) return;
        eLogin = (login.length >= 3 && login.length <= 32 && /^[a-zA-Z1-9]*$/.test(login)) ? '' : 'От 3 до 32 символов: латинские буквы и цифры 1–9';
        eEmail = (email.length >= 3 && email.length <= 32 && /^[0-9a-z-_\.]+\@[0-9a-z-]{2,}\.[a-z]{2,}$/i.test(email)) ? '' : 'Введите корректный адрес почты';
        ePass1 = pass1.length >= 3 ? '' : 'Слишком короткий пароль';
        ePass2 = (pass2 && pass1 === pass2) ? '' : 'Пароли не совпадают';
        if (eLogin || eEmail || ePass1 || ePass2) return;
        if ($accountLogin === -99) return;
        loading = true;
        executeClient('client:OnSignUpv2', login, email, promo, pass1, pass2);
        timer = setTimeout(() => { loading = false; }, 2500);
    };
</script>

<form class="panel__body stack view" novalidate on:submit|preventDefault={submit}>
    <div>
        <h1 class="h2 auth__title">Создайте аккаунт</h1>
        <p class="p">Это займёт меньше минуты.</p>
    </div>
    <AuthField bind:this={first} bind:value={login} error={eLogin} label="Логин" placeholder="Латиница и цифры" icon="user" autocomplete="username" maxlength={32} />
    <AuthField bind:value={email} error={eEmail} label="Почта" placeholder="name@mail.ru" icon="mail" autocomplete="email" maxlength={32} />
    <div class="row-f" style="align-items:flex-start">
        <div class="grow" style="display:grid;gap:6px">
            <AuthField bind:value={pass1} error={ePass1} label="Пароль" type="password" placeholder="Минимум 3 символа" icon="lock" autocomplete="new-password" maxlength={64} />
            <span class="strength" data-s={s}><i></i><i></i><i></i><i></i></span>
        </div>
        <div class="grow">
            <AuthField bind:value={pass2} error={ePass2} label="Повтор" type="password" placeholder="Ещё раз" icon="lock" autocomplete="new-password" maxlength={64} />
        </div>
    </div>
    <AuthField bind:value={promo} label="Промокод" optional={true} placeholder="Если есть" icon="gift" maxlength={32} />
    <button class="btn btn--primary btn--lg btn--block" class:is-loading={loading} type="submit">Зарегистрироваться</button>
</form>
