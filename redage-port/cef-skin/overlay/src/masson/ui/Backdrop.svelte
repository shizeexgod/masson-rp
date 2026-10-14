<script>
    // Фон экранов входа и персонажей: градиент, силуэт города, виньетка (как в дизайне .scr__bg/.scr__skyline/.scr__vignette).
    import { skylineSvg } from './skyline.js'
    export let dim = false;
</script>

<div class="scr__bg"></div>
<div class="scr__skyline">{@html skylineSvg()}</div>
<div class="scr__vignette"></div>
