<script>
    // Выбор и создание персонажа Masson RP. Сцену (3D-персонажей) рисует игра, интерфейс — поверх неё.
    // Логика RedAge сохранена: stores selectIndex/selectType/selectChar, события client:OnSelectCharacterv2,
    // client.char.delete, buyNewSlot, client.characters.customization.*.
    import { accountLogin, accountRedbucks } from 'store/account'
    import { format } from 'api/formatter'
    import Icon from '@/masson/Icon.svelte'
    import List from './MassonList.svelte'
    import Creator from './MassonCreator.svelte'
    import markImg from '@/masson/img/masson-mark-256.png'

    let mode = 'list';   // 'list' — слоты, 'create' — мастер создания
</script>

<div class="scr scr--scene">
    <div class="scr__bg"></div>
    <div class="scr__vignette"></div>

    <div class="ch__brand"><img src={markImg} alt="" style="width:64px"><b>Masson RP</b></div>
    <div class="ch__top">
        <span class="row-f" style="gap:8px"><Icon name="user" />{$accountLogin !== -99 && $accountLogin !== -1 ? $accountLogin : ''}</span>
        <span class="row-f" style="gap:8px" title="Донат-валюта"><Icon name="coin" />{format("money", $accountRedbucks)}</span>
    </div>

    {#if mode === 'list'}
        <List on:create={() => mode = 'create'} />
    {:else}
        <Creator on:back={() => mode = 'list'} />
    {/if}
</div>
