<script>
    // Ползунок Masson RP (дизайн .slider). bipolar — шкала от центра (−100…+100), заливка идёт от нуля.
    export let label = '';
    export let min = 0;
    export let max = 100;
    export let step = 1;
    export let value = 0;
    export let bipolar = false;
    export let unit = '';
    export let onChange = null;

    $: pct = (x) => ((x - min) / (max - min)) * 100;
    $: zero = bipolar ? pct((min + max) / 2) : pct(min);
    $: a = Math.min(zero, pct(value));
    $: b = Math.max(zero, pct(value));
    $: text = unit ? value + ' ' + unit : (bipolar && value > 0 ? '+' + value : String(value));

    const onInput = (e) => {
        value = Number(e.target.value);
        if (onChange) onChange(value);
    };
</script>

<div class="slider">
    <div class="slider__top"><span>{label}</span><output>{text}</output></div>
    <input type="range" {min} {max} {step} value={value} style="--a:{a}%;--b:{b}%" on:input={onInput}
           aria-label={label} />
</div>
