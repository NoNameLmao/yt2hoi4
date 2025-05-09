import { write } from 'bun'
import Tracker from './tracker'
import { Logger, yellow } from './logger'
import { join } from 'path'
import { version } from '../package.json'

const OUTPUT_ROOT = './output' as const
const HOI4_MOD_VERSION = '1.16.5' as const

class ModGenerator {
    private static instance: ModGenerator
    private tracker: Tracker | null = null
    private logger = new Logger('ModGenerator')

    private constructor() {}

    public static async getInstance(): Promise<ModGenerator> {
        if (!ModGenerator.instance) {
            ModGenerator.instance = new ModGenerator()
            ModGenerator.instance.tracker = await Tracker.getInstance()
        }
        return ModGenerator.instance
    }

    /**
     * Generate a HOI4 music mod from the given .ogg files
     * @param modName The name of the mod (used for folder and file names)
     * @param trackFiles Array of .ogg file paths (relative to downloads/)
     */
    public async generateMod(modName: string, trackFiles: string[]): Promise<void> {
        if (!this.tracker) this.tracker = await Tracker.getInstance()
        await this.tracker.setCurrentStep('mod:setup')
        this.logger.info(`Setting up mod structure for ${yellow(modName)}`)

        // Prepare folder structure
        const modRoot = `${OUTPUT_ROOT}/${modName}` as const
        const musicDir = `${modRoot}/music/${modName}` as const
        const localisationDir = `${modRoot}/localisation` as const // important: hoi4 uses "localisation" spelling, not "localization"
        const interfaceDir = `${modRoot}/interface` as const
        const gfxInterfaceDir = `${modRoot}/gfx/interface` as const
        const gfxDir = `${modRoot}/gfx` as const

        await Bun.$`mkdir -p ${musicDir}`
        await Bun.$`mkdir -p ${localisationDir}`
        await Bun.$`mkdir -p ${interfaceDir}`
        await Bun.$`mkdir -p ${gfxInterfaceDir}`
        this.logger.ok(`Created mod folder structure for ${yellow(modName)}`)

        // Copy .ogg files to music/modName
        await this.tracker.setCurrentStep('mod:copy_music')
        for (const src of trackFiles) {
            const base = src.replace(/^.*\//, '')
            const dest = `${musicDir}/${base}`
            await Bun.$`cp ./downloads/${base} ${dest}`
            this.logger.info(`Copied ${yellow(base)} to ${yellow(dest)}`)
        }

        // Write descriptor.mod
        await this.tracker.setCurrentStep('mod:descriptor')
        const descriptor = `name="${modName}"
supported_version="${HOI4_MOD_VERSION}"
`
        await write(`${modRoot}/descriptor.mod`, descriptor)
        this.logger.ok(`Wrote mod-specific descriptor.mod for ${yellow(modName)}`)
        // User-managed mods (not by Steam Workshop) require a manual definition (descriptor) outside the mod folder
        const externalDescriptor = `name="${modName}"
tags={
    "Sound"
}
path="mod/${modName}"
supported_version="${HOI4_MOD_VERSION}"
version="${version}"
`
        await write(`${OUTPUT_ROOT}/${modName}.mod`, externalDescriptor)
        this.logger.ok(`Wrote user-specific descriptor.mod for ${yellow(modName)}`)


        // Write localization file
        await this.tracker.setCurrentStep('mod:localisation')
        const locFile = `${modName}_l_english.yml`
        let locContent = `l_english:
  ${modName}: "${modName} Radio"
`
        for (const src of trackFiles) {
            const base = src.replace(/^.*\//, '')
            const trackId = base.replace(/\..*$/, '').replace(/ /g, '_')
            locContent += `  ${trackId}: "${trackId}"
`
        }
        // Convert to UTF-8 BOM
        const locBuffer = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(locContent)])
        await write(`${localisationDir}/${locFile}`, locBuffer)
        this.logger.ok(`Wrote localization file ${yellow(locFile)}`)

        // Write interface files (generate .gfx and .gui, placeholder .dds)
        await this.tracker.setCurrentStep('mod:interface')
        // .gfx file
        const gfxContent = `spriteTypes = {
    spriteType = {
        name = "GFX_${modName}_faceplate"
        texturefile = "gfx/${modName}_faceplate.dds"
        noOfFrames = 2
    }
}`
        await write(`${interfaceDir}/${modName}.gfx`, gfxContent)
        this.logger.ok(`Wrote .gfx file for ${yellow(modName)}`)
        // .gui file (generate from template)
        const guiContent = `guiTypes = {
	containerWindowType = {
		name = "${modName}_faceplate"
		position = { x =0 y=0 }
		size = { width = 590 height = 46 }

		iconType = {
			name = "musicplayer_header_bg"
			spriteType = "GFX_musicplayer_header_bg"
			position = { x= 0 y = 0 }
		}

		instantTextboxType = {
			name = "track_name"
			position = { x = 72 y = 20 }
			font = "hoi_20b"
			text = "Roger Pontare - Nar vindarna viskar mitt namn"
			maxWidth = 450
			maxHeight = 25
			format = center
		}

		instantTextboxType = {
			name = "track_elapsed"
			position = { x = 124 y = 30 }
			font = "hoi_18b"
			text = "00:00"
			maxWidth = 50
			maxHeight = 25
			format = center
		}

		instantTextboxType = {
			name = "track_duration"
			position = { x = 420 y = 30 }
			font = "hoi_18b"
			text = "02:58"
			maxWidth = 50
			maxHeight = 25
			format = center
		}

		buttonType = {
			name = "prev_button"
			position = { x = 220 y = 20 }
			quadTextureSprite = "GFX_musicplayer_previous_button"
			buttonFont = "Main_14_black"
			Orientation = "LOWER_LEFT"
			clicksound = click_close
			pdx_tooltip = "MUSICPLAYER_PREV"
		}

		buttonType = {
			name = "play_button"
			position = { x = 263 y = 20 }
			quadTextureSprite = "GFX_musicplayer_play_pause_button"
			buttonFont = "Main_14_black"
			Orientation = "LOWER_LEFT"
			clicksound = click_close
		}

		buttonType = {
			name = "next_button"
			position = { x = 336 y = 20 }
			quadTextureSprite = "GFX_musicplayer_next_button"
			buttonFont = "Main_14_black"
			Orientation = "LOWER_LEFT"
			clicksound = click_close
			pdx_tooltip = "MUSICPLAYER_NEXT"
		}

		extendedScrollbarType = {
			name = "volume_slider"
			position = { x = 100 y = 45}
			size = { width = 75 height = 18 }
			tileSize = { width = 12 height = 12}
			maxValue = 100
			minValue = 0
			stepSize = 1
			startValue = 50
			horizontal = yes
			orientation = lower_left
			origo = lower_left
			setTrackFrameOnChange = yes

			slider = {
				name = "Slider"	
				quadTextureSprite = "GFX_scroll_drager"
				position = { x=0 y = 1 }
				pdx_tooltip = "MUSICPLAYER_ADJUST_VOL"
			}

			track = {
				name = "Track"
				quadTextureSprite = "GFX_volume_track"
				position = { x=0 y = 3 }
				alwaystransparent = yes
				pdx_tooltip = "MUSICPLAYER_ADJUST_VOL"
			}
		}

		buttonType = {
			name = "shuffle_button"
			position = { x = 425 y = 20 }
			quadTextureSprite = "GFX_toggle_shuffle_buttons"
			buttonFont = "Main_14_black"
			Orientation = "LOWER_LEFT"
			clicksound = click_close
		}
	}

	containerWindowType={
		name = "${modName}_stations_entry"
		size = { width = 162 height = 130 }
		checkBoxType = {
			name = "select_station_button"
			position = { x = 0 y = 0 }
			quadTextureSprite = "GFX_${modName}_faceplate"
			clicksound = decisions_ui_button
		}
	}
}
`
        await write(`${interfaceDir}/${modName}.gui`, guiContent)
        // .dds placeholder
        const dds = Bun.file(join(__dirname, '../radio_station.dds'))
        await write(`${gfxDir}/${modName}_faceplate.dds`, dds)
        this.logger.ok(`Wrote interface files for ${yellow(modName)}`)

        // Write music script
        await this.tracker.setCurrentStep('mod:music_script')
        let musicScript = `music_station = "${modName}"
`
        for (const src of trackFiles) {
            const base = src.replace(/^.*\//, '')
            const trackId = base.replace(/\..*$/, '')
            musicScript += `music = {
    song = "${trackId}"
    chance = {
        factor = 1
        modifier = {
            factor = 1
        }
    }
}
`
        }
        await write(`${musicDir}/${modName}_music.txt`, musicScript)
        this.logger.ok(`Wrote music script for ${yellow(modName)}`)

        await this.tracker.setCurrentStep('mod:asset_files')
        let assetFile = ''
        for (const src of trackFiles) {
            const base = src.replace(/^.*\//, '')
            const trackId = base.replace(/\..*$/, '')
            assetFile += `music = {
    name = "${trackId}"
    file = "${base}"
    volume = 0.65
}
`
        }
        await write(`${musicDir}/${modName}_music.asset`, assetFile)
        this.logger.ok(`Wrote music asset file for ${yellow(modName)}`)

        await this.tracker.setCurrentStep('mod:done')
        this.logger.ok(`Mod generation complete for ${yellow(modName)}`)
    }
}

export default ModGenerator
