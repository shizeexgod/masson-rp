<script>
    // Лицензии Masson RP. Данные и закрытие как у RedAge: viewData = [имя, фамилия, дата, пол, лицензии], автозакрытие через 10 с.
    import { executeClient } from 'api/rage'
    import { onDestroy } from 'svelte'
    import Win from '@/masson/ui/Win.svelte'
    export let viewData;

    let firstname = viewData[0],
        lastname = viewData[1],
        date = viewData[2],
        gender = viewData[3],
        lics = viewData[4],
        timer = setTimeout(() => HideDocs(), 10000);

    window.license = { hide: () => HideDocs() };

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

<Win icon="id" title="Лицензии" sub="Сданные экзамены" size="sm" onClose={HideDocs}>
    <div class="stack">
        <div class="kv"><span>Имя</span><b>{firstname} {lastname}</b></div>
        <div class="kv"><span>Пол</span><b>{gender}</b></div>
        <div class="kv"><span>Дата выдачи</span><b>{date}</b></div>
        <div class="kv"><span>Лицензии</span><b>{lics}</b></div>
    </div>
</Win>
