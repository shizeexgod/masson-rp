<script>
    import { gender, updateGender } from 'store/customization'
    import { selectIndex } from '../store.js'
    import Icon from '@/masson/Icon.svelte'
</script>

<div><div class="h2">Пол персонажа</div><p class="p" style="margin-top:6px">От выбора зависят доступные причёски и одежда.</p></div>
<div class="grid g2">
    <button class="tile big" class:is-active={$gender === true} on:click={() => updateGender($selectIndex, true)}><Icon name="user" />Мужской</button>
    <button class="tile big" class:is-active={$gender === false} on:click={() => updateGender($selectIndex, false)}><Icon name="user" />Женский</button>
</div>
