import React, { useEffect, useState } from 'react'
import Router from 'next/router'
import dynamic from 'next/dynamic'
import io from "socket.io-client";
import Layout from '../components/layout'
import Sidebar from '../components/sidebar'
import { Vector } from '../libs/movement'
import { Logger } from '../libs/lib'

// init socket.io client
const ws = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL, {
  reconnectionDelayMax: 10000,
  transports: ["websocket"],
  reconnection: false,
  autoConnect: false,
})

const Me = dynamic(() => import('../components/me'), { ssr: false })
const Mate = dynamic(() => import('../components/mate'), { ssr: false })

const log = new Logger("Index", "color: green; background: yellow")

const isDEV = process.env.NODE_ENV == "development"
log.log("isDEV=", isDEV)

let me = {}

export default function Index() {
  const [logged, setLogged] = useState(false)
  const [onlineState, setOnlineState] = useState(false)

  useEffect(() => {
    const accessToken = localStorage.getItem(process.env.NEXT_PUBLIC_ACCESSTOKENKEY)
    if (!isDEV && !accessToken) {
      Router.push('/login')
      return
    }

    const u = localStorage.getItem(process.env.NEXT_PUBLIC_USERKEY)
    me = JSON.parse(u)
    setLogged(true)
    log.log('accessToken:', accessToken)
    log.log('me:', me)
  }, [])

  const [mates, setMates] = useState([])

  useEffect(() => {
    log.log('me---:', me)
      // `online` event will be occured when user is connected to websocket
    ws.on('online', mate => {
      if(mate.name == me.login) {
        log.log('[online] is Me, ignore', me.login)
        return
      }
      mate.key = mate.name
      mate.pos = new Vector(15, 15)
      setMates(arr => [...arr, mate])
      log.log('[online] over:', mates.length)
    })

    // `offline` event will be occured when other users leave
    ws.on('offline', mate => {
      log.log('[offline]', mate.name)
      setMates(arr => arr.filter(p => p.name != mate.name))
      log.log('[offline] counts: ', mates.length)
    })

    ws.on('ask', p => {
      log.log("[ask]", p)
    })

    ws.on('movement', mv => {
      log.log("[movement]", mv)
    })

    ws.on('sync', state => {
      log.log("[sync]", state, ", Me:", me.login)
      if(state.name == me.login) {
        log.log('[sync] is Me, ignore', me.login)
        return
      }

      setMates(arr => {
        let shouldAdd = arr.every(p => {
          if(p.name == state.name){
            return false
          }
          return true
        })
        if(shouldAdd) {
          log.log("[sync] add", state)
          state.key = state.name
          return [...arr, state]
        }
        return arr
      })
    })

    // broadcast to others I am online when WebSocket connected
    ws.on('connect', () => { 
      log.log("WS CONNECTED", ws.id, ws.connected)
      ws.emit('online', { name: me.login, avatar: me.avatar })
      setOnlineState(true)
    })

    ws.on('disconnect', (reason) => { 
      console.error("WS DISCONNECT", reason)
      setOnlineState(false)
    })

    ws.on('connect_error', (error) => { 
      console.error("WS CONNECT_ERROR", error)
      setOnlineState(false)
    })

    return () => {
      ws.disconnect("bye")
    }
  }, [])

  const disconnect = () => {
    log.log('[disconnect] EVT')
    ws.disconnect()
  }

  if (!logged) {
    return null
  }

  return (
    <Layout>
      <Sidebar onlineState={ onlineState } count = { mates.length + 1 } />
      <section>
        <Me sock={ws} name={me.login} pos={{left:30, top:0}} avatar={me.avatar} />
        {mates.map(m => {
          return <Mate key={m.name} sock={ws} name={m.name} pos={m.pos} avatar={m.avatar} />
        })}
        {/* <button onClick={ disconnect } >Disconnect</button> */}
      </section>
  </Layout>
  )
}