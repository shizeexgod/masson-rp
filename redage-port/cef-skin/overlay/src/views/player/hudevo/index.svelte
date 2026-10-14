<script>
    import {format} from "api/formatter";
    import { executeClientAsyncToGroup } from "api/rage";

    export let visible;
    import { isPlayer, isPhone } from 'store/hud'
    import './main.sass';
    import './fonts/style.css';
    import './fonts/hudfonts/style.css';
    import { fly } from 'svelte/transition';


    import PetControl from './elements/petcontrol.svelte';
    import UseButton from './elements/usebutton.svelte';
    import MassonHud from '@/masson/hud/MassonHud.svelte'
    import Streamer from './elements/streamer.svelte'
    import Lobby from './elements/lobby.svelte'
    import AdminInfo from './elements/admininfo.svelte'

    import Walkietalkie from './walkietalkie/index.svelte'
    import Phone from './phonenew/index.svelte';
    import PhoneNotify from './phonenew/indexNotify.svelte';


    let SelectPopup = "";

    let screenX = 0;
    let screenY = 0;
    let aspectRatio = 0;

    let SafeSone = {
        x: 0,
        y: 0
    }
    let lastStatus = 0;

    window.hud = {
        updateSafeZone: (screenWidht, screenHeight, safeZoneSize, ratio) => {
            aspectRatio = ratio;
            //console.log(`window.hud.updateSafeZone (${screenWidht}, ${screenHeight}, ${safeZoneSize}, ${aspectRatio})`)
            safeZoneSize = (((1.0 - safeZoneSize) * 0.5) * 100.0);

            screenX = screenWidht / 100;
            screenY = screenHeight / 100;

            SafeSone.x = screenX * safeZoneSize;
            SafeSone.y = screenY * safeZoneSize;
            
            let savezoneDiv = document.querySelectorAll('#hudevo');
            savezoneDiv.forEach(function(div) {
                div.style.paddingRight = div.style.paddingLeft = SafeSone.x + "px";
                div.style.paddingTop = div.style.paddingBottom = SafeSone.y + "px";
            });

            /*savezoneDiv = document.querySelector('body');
            savezoneDiv.style.width = screenWidht + "px";
            savezoneDiv.style.height = screenHeight + "px";

            savezoneDiv = document.querySelector('#viewcontainer');
            savezoneDiv.style.width = screenWidht + "px";
            savezoneDiv.style.height = screenHeight + "px";*/

            window.hud.updateMapSize (lastStatus)
        },
        updateMapSize: (status) => {
            lastStatus = status;
            const map = document.querySelector('.hudevo__map');
            if (!map) return;
            if (status == 2) {
                map.style.width = (screenX * 12.545 * aspectRatio) + "px";
                map.style.height = (screenY * 23.96 * aspectRatio) + "px";
            } else if (status == 3) {                
                map.style.width = map.style.height = 0 + "px";
            } else {                
                map.style.width = (screenX * 7.91 * aspectRatio) + "px";
                map.style.height = (screenY * 10.6875 * aspectRatio) + "px";
            }
        },
        updateMapWidth: (width) => {
            const map = document.querySelector('.hudevo__map');
            if (!map) return;
            map.style.width = width + "px";
        }
    }

    const WeaponsAmmoTypes = {"100":200,"101":200,"102":200,"103":200,"104":200,"105":200,"106":200,"107":200,"108":200,"110":200,"111":200,"112":200,"113":200,"114":200,"151":200,"152":200,"115":201,"116":201,"117":201,"118":201,"119":201,"120":201,"121":201,"122":201,"123":201,"124":201,"125":201,"153":201,"126":202,"127":202,"128":202,"129":202,"130":202,"131":202,"132":202,"133":202,"134":202,"135":202,"136":203,"137":203,"138":203,"139":203,"140":203,"154":200,"155":200,"156":200,"157":200,"158":200,"159":200,"160":200,"161":200,"162":200,"141":204,"142":204,"143":204,"144":204,"145":204,"146":204,"147":204,"148":204,"149":204};

    const GetAmmoIcon = (item) => {
        if (item > 0) {
            if (WeaponsAmmoTypes [item] && window.getItem (WeaponsAmmoTypes [item])) return window.getItem (WeaponsAmmoTypes [item]).Icon;
            else if (window.getItem (item)) return window.getItem (item).Icon;
        }
        return '';
    }  

    let weaponItemId = 0;
    window.hudStore.weaponItemId = (value) => weaponItemId = value;

    let clipSize = 0;
    window.hudStore.clipSize = (value) => clipSize = value;

    let ammo = 0;
    window.hudStore.ammo = (value) => ammo = value;

    let isWalkietalkie = false;
    window.hudStore.isWalkietalkie = (value) => isWalkietalkie = value;

    let isHudVisible = true;
    window.hudStore.isHudVisible = (value) => isHudVisible = value;

    let isHudNewPhone = false;
    window.hudStore.isHudNewPhone = (value) => isHudNewPhone = value;

    let isTaxiCounter = false;
    window.hudStore.isTaxiCounter = (value) => isTaxiCounter = value;


    let phoneNotification = false;
    const onPhoneNotification = (json) => {
        if (json)
            json = JSON.parse(json);

        phoneNotification = json;
    }
    import { addListernEvent } from 'api/functions';
    addListernEvent ("phone.notify", onPhoneNotification)
        

    let hour = 0
    window.hudStore.setHour = (value) => hour = value;
    const isDay = (_hour) => {
        if (_hour == 0 || _hour == 1 || _hour == 2 || _hour == 3 || _hour == 4 || _hour == 5 || _hour == 21 || _hour == 22 || _hour == 23) return false;
        else return true;
    }
</script>
<MassonHud visible={visible && isHudVisible} />
<div id="hudevo" class:hudevo__hide={!(visible && isHudVisible)} class:night={isDay(hour)}>
    <div class="hudevo__left">
        <div class="box-column hudevo__leftcenter_absolute">
            <PetControl />
        </div>
    </div>
    <div class="hudevo__center">
        <div class="hudevo__center_bottom">
            <UseButton />
            <!-- <Streamer /> -->
        </div>
    </div>
    <div class="hudevo__right">
        <!-- <Lobby /> -->
        <AdminInfo />
    </div>
</div>

{#if visible && isHudVisible}
    {#if isHudNewPhone}
        <div id="hudevo">
            <Phone {phoneNotification} />
        </div>
    {:else if phoneNotification}
        <div id="hudevo">
            <PhoneNotify {isHudNewPhone} {phoneNotification} />
        </div>
    {/if}
{/if}
<div id="hudevo" class:hudevo__hide={!(visible && isHudVisible) || !isWalkietalkie}>
    <Walkietalkie />
</div>