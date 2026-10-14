<script>
    // Иконка Masson RP: 24×24, штрих 1.75, цвет — currentColor (акцент — класс ico--accent).
    import { ICONS } from './icons.js'
    export let name = '';
    export let cls = '';
</script>

<svg class="ico {cls}" viewBox="0 0 24 24" aria-hidden="true">{@html ICONS[name] || ''}</svg>
