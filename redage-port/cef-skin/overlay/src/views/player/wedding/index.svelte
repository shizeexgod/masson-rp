<script>
    // ЗАГС Masson RP. Логика RedAge прежняя: проверки имени и денег, client.wedding.married(имя, тип фамилии).
    import { executeClient } from 'api/rage'
    import { format } from 'api/formatter'
    import { charMoney } from 'store/chars.js'
    import { validate } from 'api/validation';
    import Win from '@/masson/ui/Win.svelte'
    export let viewData;

    const price = viewData.price;
    let weddingType = viewData.type;      // 0 — брак, 1 — развод

    const weddingTypeText = [
        "Здесь влюблённые могут закрепить свои чувства узами брака. Укажите имя или ID второго человека.",
        "Иногда то, что кажется любовью, оказывается влюблённостью. Если решение принято, оформите развод.",
    ];

    let typeSurname = 0;
    let nameInput = "";

    const onBuy = () => {
        if (weddingType == 0) {
            if (nameInput.length === 0) {
                window.notificationAdd(4, 9, `Вы не указали ID или имя человека`, 3000);
                return;
            }
            const check = validate("name", nameInput);
            if (/\D/.test(nameInput) && !check.valid) {
                window.notificationAdd(4, 9, check.text, 3000);
                return;
            }
        }
        if (price > Number($charMoney)) {
            window.notificationAdd(4, 9, `У Вас не хватает денег`, 3000);
            return;
        }
        executeClient("client.wedding.married", nameInput, typeSurname);
    };
</script>

<Win icon="heart" title={weddingType == 0 ? 'ЗАГС · Брак' : 'ЗАГС · Развод'} sub={weddingTypeText[weddingType]} size="sm">
    {#if weddingType === 0}
        <label class="field">
            <span class="field__label">Имя или ID</span>
            <span class="input"><input bind:value={nameInput} placeholder="Имя или ID" autocomplete="off"></span>
        </label>
        <div class="seg">
            {#each ['Жениха', 'Невесты', 'Не менять'] as t, i}
                <button class:is-active={typeSurname === i} on:click={() => typeSurname = i}>{t}</button>
            {/each}
        </div>
        <p class="p">Фамилия: {['жениха', 'невесты', 'без изменений'][typeSurname]}</p>
    {/if}
    <div class="kv"><span>Стоимость услуги</span><b>${format("money", price)}</b></div>
    <button class="btn btn--primary btn--lg btn--block" on:click={onBuy}>Оплатить</button>
</Win>
