import * as THREE from 'three'
import CANNON from 'cannon'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

export default class Car
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.resources = _options.resources
        this.objects = _options.objects
        this.physics = _options.physics
        this.shadows = _options.shadows
        this.materials = _options.materials
        this.controls = _options.controls
        this.sounds = _options.sounds
        this.renderer = _options.renderer
        this.camera = _options.camera
        this.debug = _options.debug
        this.config = _options.config

        // Set up
        this.container = new THREE.Object3D()
        this.position = new THREE.Vector3()

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('car')
            // this.debugFolder.open()
        }

        this.setModels()
        this.setMovement()
        this.setChassis()
        this.setAntena()
        this.setBackLights()
        this.setWheels()
        this.setSpoiler()
        this.setHeadlights()
        this.setSideMirrors()
        this.setExhaust()
        this.setTransformControls()
        this.setShootingBall()
        this.setKlaxon()
    }

    setModels()
    {
        this.models = {}

        // Cyber truck
        if(this.config.cyberTruck)
        {
            this.models.chassis = this.resources.items.carCyberTruckChassis
            this.models.antena = this.resources.items.carCyberTruckAntena
            this.models.backLightsBrake = this.resources.items.carCyberTruckBackLightsBrake
            this.models.backLightsReverse = this.resources.items.carCyberTruckBackLightsReverse
            this.models.wheel = this.resources.items.carCyberTruckWheel
        }

        // Default (we'll procedurally add GT3-inspired details)
        else
        {
            this.models.chassis = this.resources.items.carDefaultChassis
            this.models.antena = this.resources.items.carDefaultAntena
            this.models.backLightsBrake = this.resources.items.carDefaultBackLightsBrake
            this.models.backLightsReverse = this.resources.items.carDefaultBackLightsReverse
            this.models.wheel = this.resources.items.carDefaultWheel
        }
    }

    setMovement()
    {
        this.movement = {}
        this.movement.speed = new THREE.Vector3()
        this.movement.localSpeed = new THREE.Vector3()
        this.movement.acceleration = new THREE.Vector3()
        this.movement.localAcceleration = new THREE.Vector3()
        this.movement.lastScreech = 0

        // Time tick
        this.time.on('tick', () =>
        {
            // Movement
            const movementSpeed = new THREE.Vector3()
            movementSpeed.copy(this.chassis.object.position).sub(this.chassis.oldPosition)
            movementSpeed.multiplyScalar(1 / this.time.delta * 17)
            this.movement.acceleration = movementSpeed.clone().sub(this.movement.speed)
            this.movement.speed.copy(movementSpeed)

            this.movement.localSpeed = this.movement.speed.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), - this.chassis.object.rotation.z)
            this.movement.localAcceleration = this.movement.acceleration.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), - this.chassis.object.rotation.z)

            // Sound
            this.sounds.engine.speed = this.movement.localSpeed.x
            this.sounds.engine.acceleration = this.controls.actions.up ? (this.controls.actions.boost ? 1 : 0.5) : 0

            if(this.movement.localAcceleration.x > 0.03 && this.time.elapsed - this.movement.lastScreech > 5000)
            {
                this.movement.lastScreech = this.time.elapsed
                this.sounds.play('screech')
            }
        })
    }

    setChassis()
    {
        this.chassis = {}
        this.chassis.offset = new THREE.Vector3(0, 0, - 0.28)
        this.chassis.object = this.objects.getConvertedMesh(this.models.chassis.scene.children)
        this.chassis.object.position.copy(this.physics.car.chassis.body.position)
        this.chassis.oldPosition = this.chassis.object.position.clone()
        this.container.add(this.chassis.object)

        // Revert chassis color to previous blue
        const chassisMaterial = this.materials.shades.items.blue
        for(const _child of this.chassis.object.children)
        {
            if(_child instanceof THREE.Mesh && !_child.name.includes('glass') && !_child.name.includes('light'))
            {
                _child.material = chassisMaterial
            }
        }

        this.shadows.add(this.chassis.object, { sizeX: 3, sizeY: 2, offsetZ: 0.2 })

        // Time tick
        this.time.on('tick', () =>
        {
            // Save old position for movement calculation
            this.chassis.oldPosition = this.chassis.object.position.clone()

            // Update if mode physics
            if(!this.transformControls.enabled)
            {
                this.chassis.object.position.copy(this.physics.car.chassis.body.position).add(this.chassis.offset)
                this.chassis.object.quaternion.copy(this.physics.car.chassis.body.quaternion)
            }

            // Update position
            this.position.copy(this.chassis.object.position)
        })
    }

    setAntena()
    {
        this.antena = {}

        this.antena.speedStrength = 10
        this.antena.damping = 0.035
        this.antena.pullBackStrength = 0.02

        this.antena.object = this.objects.getConvertedMesh(this.models.antena.scene.children)
        this.chassis.object.add(this.antena.object)

        this.antena.speed = new THREE.Vector2()
        this.antena.absolutePosition = new THREE.Vector2()
        this.antena.localPosition = new THREE.Vector2()

        // Time tick
        this.time.on('tick', () =>
        {
            const max = 1
            const accelerationX = Math.min(Math.max(this.movement.acceleration.x, - max), max)
            const accelerationY = Math.min(Math.max(this.movement.acceleration.y, - max), max)

            this.antena.speed.x -= accelerationX * this.antena.speedStrength
            this.antena.speed.y -= accelerationY * this.antena.speedStrength

            const position = this.antena.absolutePosition.clone()
            const pullBack = position.negate().multiplyScalar(position.length() * this.antena.pullBackStrength)
            this.antena.speed.add(pullBack)

            this.antena.speed.x *= 1 - this.antena.damping
            this.antena.speed.y *= 1 - this.antena.damping

            this.antena.absolutePosition.add(this.antena.speed)

            this.antena.localPosition.copy(this.antena.absolutePosition)
            this.antena.localPosition.rotateAround(new THREE.Vector2(), - this.chassis.object.rotation.z)

            this.antena.object.rotation.y = this.antena.localPosition.x * 0.1
            this.antena.object.rotation.x = this.antena.localPosition.y * 0.1
        })

        // Debug
        if(this.debug)
        {
            const folder = this.debugFolder.addFolder('antena')
            folder.open()

            folder.add(this.antena, 'speedStrength').step(0.001).min(0).max(50)
            folder.add(this.antena, 'damping').step(0.0001).min(0).max(0.1)
            folder.add(this.antena, 'pullBackStrength').step(0.0001).min(0).max(0.1)
        }
    }

    setBackLights()
    {
        this.backLightsBrake = {}

        this.backLightsBrake.material = this.materials.pures.items.red.clone()
        this.backLightsBrake.material.transparent = true
        this.backLightsBrake.material.opacity = 0.5

        this.backLightsBrake.object = this.objects.getConvertedMesh(this.models.backLightsBrake.scene.children)
        for(const _child of this.backLightsBrake.object.children)
        {
            _child.material = this.backLightsBrake.material
        }

        this.chassis.object.add(this.backLightsBrake.object)

        // Back lights reverse
        this.backLightsReverse = {}

        this.backLightsReverse.material = this.materials.pures.items.yellow.clone()
        this.backLightsReverse.material.transparent = true
        this.backLightsReverse.material.opacity = 0.5

        this.backLightsReverse.object = this.objects.getConvertedMesh(this.models.backLightsReverse.scene.children)
        for(const _child of this.backLightsReverse.object.children)
        {
            _child.material = this.backLightsReverse.material
        }

        this.chassis.object.add(this.backLightsReverse.object)

        // Time tick
        this.time.on('tick', () =>
        {
            this.backLightsBrake.material.opacity = this.physics.controls.actions.brake ? 1 : 0.5
            this.backLightsReverse.material.opacity = this.physics.controls.actions.down ? 1 : 0.5
        })
    }

    setWheels()
    {
        this.wheels = {}
        this.wheels.object = this.objects.getConvertedMesh(this.models.wheel.scene.children)
        // Override for GT3: silver rims, black tires
        const rimMaterial = this.materials.shades.items.silver
        const tireMaterial = this.materials.shades.items.black
        if(this.wheels.object.material)
        {
            this.wheels.object.material = tireMaterial
        }
        for(const _child of this.wheels.object.children)
        {
            if(_child instanceof THREE.Mesh)
            {
                if(_child.name.includes('rim') || _child.name.includes('hub'))
                {
                    _child.material = rimMaterial
                }
                else
                {
                    _child.material = tireMaterial
                }
            }
        }
        this.wheels.items = []

        for(let i = 0; i < 4; i++)
        {
            const object = this.wheels.object.clone()

            this.wheels.items.push(object)
            this.container.add(object)
        }

        // Time tick
        this.time.on('tick', () =>
        {
            if(!this.transformControls.enabled)
            {
                for(const _wheelKey in this.physics.car.wheels.bodies)
                {
                    const wheelBody = this.physics.car.wheels.bodies[_wheelKey]
                    const wheelObject = this.wheels.items[_wheelKey]

                    wheelObject.position.copy(wheelBody.position)
                    wheelObject.quaternion.copy(wheelBody.quaternion)
                }
            }
        })
    }

    setSpoiler()
    {
        // Always use procedural spoiler based on chassis size (GT3-inspired)
        this.createProceduralSpoiler()
    }

    createProceduralSpoiler()
    {
        // Procedural GT3-style rear wing
        const bbox = new THREE.Box3().setFromObject(this.chassis.object)
        const size = new THREE.Vector3()
        bbox.getSize(size)

        const wingWidth = size.y * 1.0
        const wingDepth = Math.max(size.x * 0.12, 0.16)
        const wingThickness = Math.max(size.z * 0.06, 0.06)

        const supportWidth = wingDepth * 0.4
        const supportDepth = wingThickness * 1.2
        const supportHeight = Math.max(size.z * 0.28, 0.18)

        const wingGeo = new THREE.BoxGeometry(wingDepth, wingWidth, wingThickness)
        const supportGeo = new THREE.BoxGeometry(supportWidth, supportDepth, supportHeight)
        const material = this.materials.shades.items.black

        this.spoiler = {}
        this.spoiler.object = new THREE.Object3D()
        const wing = new THREE.Mesh(wingGeo, material)
        const leftSupport = new THREE.Mesh(supportGeo, material)
        const rightSupport = new THREE.Mesh(supportGeo, material)

        // Arrange parts
        wing.position.set(0, 0, 0)
        leftSupport.position.set(wingDepth * 0.05, - wingWidth * 0.25, - supportHeight * 0.5)
        rightSupport.position.set(wingDepth * 0.05, wingWidth * 0.25, - supportHeight * 0.5)

        this.spoiler.object.add(wing)
        this.spoiler.object.add(leftSupport)
        this.spoiler.object.add(rightSupport)

        // Position at the rear top
        const rearZ = size.z / 2 + wingThickness * 0.5
        this.spoiler.object.position.set(- wingDepth * 0.25, 0, rearZ)
        this.spoiler.object.rotation.x = - Math.PI * 0.03

        this.chassis.object.add(this.spoiler.object)
        this.shadows.add(this.spoiler.object, { sizeX: wingDepth, sizeY: wingWidth, offsetZ: 0.25 })

        // Dynamic deployment based on speed
        this.time.on('tick', () =>
        {
            const deployAngle = Math.min(Math.max(this.movement.localSpeed.x / 50, 0), 0.2)
            this.spoiler.object.rotation.x = - (Math.PI * 0.02 + deployAngle)
        })
    }

    // setLogo() removed per request

    setHeadlights()
    {
        if(this.config.cyberTruck)
        {
            return
        }

        // Procedural headlight capsules (small emissive spheres) near the front corners
        this.headlights = {}
        this.headlights.material = this.materials.pures.items.white.clone()
        this.headlights.material.emissive = new THREE.Color(0xffffff)
        this.headlights.material.emissiveIntensity = 0.8
        this.headlights.material.transparent = true
        this.headlights.material.opacity = 0.95

        const bbox = new THREE.Box3().setFromObject(this.chassis.object)
        const size = new THREE.Vector3()
        const center = new THREE.Vector3()
        bbox.getSize(size)
        bbox.getCenter(center)

        const radius = Math.max(size.z * 0.04, 0.05)
        const geo = new THREE.SphereGeometry(radius, 16, 12)

        this.headlights.left = new THREE.Mesh(geo, this.headlights.material)
        this.headlights.right = new THREE.Mesh(geo, this.headlights.material)

        const x = bbox.max.x - radius * 0.2
        const y = center.y - size.y * 0.25
        const z = center.z + size.z * 0.2
        this.headlights.left.position.set(x - center.x, -y - center.y, z - center.z)
        this.headlights.right.position.set(x - center.x, y - center.y, z - center.z)

        this.chassis.object.add(this.headlights.left)
        this.chassis.object.add(this.headlights.right)

        // Dynamic intensity (e.g., brighter when accelerating)
        this.time.on('tick', () =>
        {
            this.headlights.material.emissiveIntensity = 0.5 + Math.abs(this.movement.localAcceleration.x) * 0.5
        })

        // Debug
        if(this.debug)
        {
            const folder = this.debugFolder.addFolder('headlights')
            folder.add(this.headlights.material, 'emissiveIntensity').min(0).max(2)
        }
    }

    setSideMirrors()
    {
        if(this.config.cyberTruck)
        {
            return
        }

        // Procedural aerodynamic side mirrors (small boxes)
        this.sideMirrors = {}
        const bbox = new THREE.Box3().setFromObject(this.chassis.object)
        const size = new THREE.Vector3()
        const center = new THREE.Vector3()
        bbox.getSize(size)
        bbox.getCenter(center)

        const mirrorGeo = new THREE.BoxGeometry(Math.max(size.x * 0.06, 0.1), Math.max(size.y * 0.06, 0.1), Math.max(size.z * 0.12, 0.1))
        const mirrorMaterial = this.materials.shades.items.black

        this.sideMirrors.left = new THREE.Mesh(mirrorGeo, mirrorMaterial)
        this.sideMirrors.right = new THREE.Mesh(mirrorGeo, mirrorMaterial)

        const x = center.x
        const y = center.y + size.y * 0.55
        const z = center.z + size.z * 0.05
        this.sideMirrors.left.position.set(x - center.x, -y - center.y, z - center.z)
        this.sideMirrors.right.position.set(x - center.x, y - center.y, z - center.z)

        this.chassis.object.add(this.sideMirrors.left)
        this.chassis.object.add(this.sideMirrors.right)

        // Debug
        if(this.debug)
        {
            const folder = this.debugFolder.addFolder('sideMirrors')
            folder.add(this.sideMirrors.left.position, 'x').min(-2).max(0)
            folder.add(this.sideMirrors.left.position, 'y').min(-1).max(1)
            folder.add(this.sideMirrors.left.position, 'z').min(0).max(1)
        }
    }

    setExhaust()
    {
        if(this.config.cyberTruck)
        {
            return
        }

        // Procedural central dual exhaust tips
        this.exhaust = {}
        const bbox = new THREE.Box3().setFromObject(this.chassis.object)
        const size = new THREE.Vector3()
        const center = new THREE.Vector3()
        bbox.getSize(size)
        bbox.getCenter(center)

        const radius = Math.max(size.z * 0.05, 0.06)
        const length = Math.max(size.x * 0.12, 0.16)
        const geo = new THREE.CylinderGeometry(radius, radius, length, 16)
        const mat = this.materials.shades.items.silver

        this.exhaust.left = new THREE.Mesh(geo, mat)
        this.exhaust.right = new THREE.Mesh(geo, mat)
        this.exhaust.left.rotation.z = Math.PI * 0.5
        this.exhaust.right.rotation.z = Math.PI * 0.5

        const x = bbox.min.x - length * 0.25
        const yOff = size.y * 0.08
        const z = center.z - size.z * 0.35
        this.exhaust.left.position.set(x - center.x, -yOff - center.y, z - center.z)
        this.exhaust.right.position.set(x - center.x, yOff - center.y, z - center.z)

        this.chassis.object.add(this.exhaust.left)
        this.chassis.object.add(this.exhaust.right)
    }

    setTransformControls()
    {
        this.transformControls = new TransformControls(this.camera.instance, this.renderer.domElement)
        this.transformControls.size = 0.5
        this.transformControls.attach(this.chassis.object)
        this.transformControls.enabled = false
        this.transformControls.visible = this.transformControls.enabled

        document.addEventListener('keydown', (_event) =>
        {
            if(this.mode === 'transformControls')
            {
                if(_event.key === 'r')
                {
                    this.transformControls.setMode('rotate')
                }
                else if(_event.key === 'g')
                {
                    this.transformControls.setMode('translate')
                }
            }
        })

        this.transformControls.addEventListener('dragging-changed', (_event) =>
        {
            this.camera.orbitControls.enabled = !_event.value
        })

        this.container.add(this.transformControls)

        if(this.debug)
        {
            const folder = this.debugFolder.addFolder('controls')
            folder.open()

            folder.add(this.transformControls, 'enabled').onChange(() =>
            {
                this.transformControls.visible = this.transformControls.enabled
            })
        }
    }

    setShootingBall()
    {
        if(!this.config.cyberTruck)
        {
            return
        }

        window.addEventListener('keydown', (_event) =>
        {
            if(_event.key === 'b')
            {
                const angle = Math.random() * Math.PI * 2
                const distance = 10
                const x = this.position.x + Math.cos(angle) * distance
                const y = this.position.y + Math.sin(angle) * distance
                const z = 2 + 2 * Math.random()
                const bowlingBall = this.objects.add({
                    base: this.resources.items.bowlingBallBase.scene,
                    collision: this.resources.items.bowlingBallCollision.scene,
                    offset: new THREE.Vector3(x, y, z),
                    rotation: new THREE.Euler(Math.PI * 0.5, 0, 0),
                    duplicated: true,
                    shadow: { sizeX: 1.5, sizeY: 1.5, offsetZ: - 0.15, alpha: 0.35 },
                    mass: 5,
                    soundName: 'bowlingBall',
                    sleep: false
                })

                const carPosition = new CANNON.Vec3(this.position.x, this.position.y, this.position.z + 1)
                let direction = carPosition.vsub(bowlingBall.collision.body.position)
                direction.normalize()
                direction = direction.scale(100)
                bowlingBall.collision.body.applyImpulse(direction, bowlingBall.collision.body.position)
            }
        })
    }

    setKlaxon()
    {
        this.klaxon = {}
        this.klaxon.lastTime = this.time.elapsed

        window.addEventListener('keydown', (_event) =>
        {
            // Play horn sound
            if(_event.code === 'KeyH')
            {
                if(this.time.elapsed - this.klaxon.lastTime > 400)
                {
                    this.physics.car.jump(false, 150)
                    this.klaxon.lastTime = this.time.elapsed
                }

                this.sounds.play(Math.random() < 0.002 ? 'carHorn2' : 'carHorn1')
            }

            // Rain horns
            if(_event.key === 'k')
            {
                const x = this.position.x + (Math.random() - 0.5) * 3
                const y = this.position.y + (Math.random() - 0.5) * 3
                const z = 6 + 2 * Math.random()

                this.objects.add({
                    base: this.resources.items.hornBase.scene,
                    collision: this.resources.items.hornCollision.scene,
                    offset: new THREE.Vector3(x, y, z),
                    rotation: new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2),
                    duplicated: true,
                    shadow: { sizeX: 1.5, sizeY: 1.5, offsetZ: - 0.15, alpha: 0.35 },
                    mass: 5,
                    soundName: 'horn',
                    sleep: false
                })
            }
        })
    }
}