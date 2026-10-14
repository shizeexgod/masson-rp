<script>
    // Паспорт Masson RP. Данные и закрытие как у RedAge: viewData = [номер, имя, фамилия, дата, пол, организация, работа], автозакрытие через 10 с.
    import { executeClient } from 'api/rage'
    import { onDestroy } from 'svelte'
    import Win from '@/masson/ui/Win.svelte'
    export let viewData;

    let number = viewData[0],
        firstname = viewData[1],
        lastname = viewData[2],
        date = viewData[3],
        gender = viewData[4],
        member = viewData[5],
        work = viewData[6],
        timer = setTimeout(() => HideDocs(), 10000);

    window.passport = { hide: () => HideDocs() };

    const HideDocs = () => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
            executeClient('dochide');
            window.router.setHud();
        }
    };

    onDestroy(() => { if (timer !== null) clearTimeout(timer); });
</script>

<Win icon="id" title="Паспорт" sub="Штат Сан-Андреас" size="sm" onClose={HideDocs}>
    <div class="cols" style="grid-template-columns:1fr 1fr;gap:20px">
        <div class="stack">
            <div class="kv"><span>Имя</span><b>{firstname}</b></div>
            <div class="kv"><span>Фамилия</span><b>{lastname}</b></div>
            <div class="kv"><span>Пол</span><b>{gender}</b></div>
            <div class="kv"><span>Дата выдачи</span><b>{date}</b></div>
        </div>
        <div class="stack">
            <div class="kv"><span>Номер</span><b>{number}</b></div>
            <div class="kv"><span>Организация</span><b>{member}</b></div>
            <div class="kv"><span>Работа</span><b>{work}</b></div>
        </div>
    </div>
</Win>
