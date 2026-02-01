import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient' // Подключаем твой "кабель" к базе

function App() {
  const [itemName, setItemName] = useState('Загрузка...')
  const [quantity, setQuantity] = useState(0)
  const [loading, setLoading] = useState(true) // Чтобы показывать "Часики"

  // 1. ЗАГРУЗКА ДАННЫХ (Аналог FormCreate)
  useEffect(() => {
    fetchMilk()
  }, [])

  async function fetchMilk() {
    // Делаем SELECT * FROM inventory_items WHERE name = 'Молоко'
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('name', 'Молоко')
      .single() // Ждем только одну запись

    if (error) {
      console.error('Ошибка при чтении:', error)
      setItemName('Ошибка связи')
    } else if (data) {
      setItemName(data.name)
      setQuantity(data.current_quantity)
    }
    setLoading(false)
  }

  // 2. ОБНОВЛЕНИЕ ДАННЫХ (Аналог UPDATE query)
  async function updateQuantity(change) {
    const newQuantity = quantity + change
    if (newQuantity < 0) return

    // Сразу меняем на экране (оптимистичный интерфейс), чтобы не ждать сервера
    setQuantity(newQuantity)

    // А теперь отправляем в базу
    const { error } = await supabase
      .from('inventory_items')
      .update({ current_quantity: newQuantity })
      .eq('name', 'Молоко')

    if (error) {
      console.error('Не удалось сохранить!', error)
      // Если ошибка - откатываем значение назад (по-хорошему)
      alert('Ошибка сохранения в облако!')
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>☁️ Cloud ERP v1.0</h1>
      
      <div style={{ 
        border: '1px solid #ccc', 
        padding: '20px', 
        borderRadius: '10px', 
        maxWidth: '300px',
        backgroundColor: loading ? '#f0f0f0' : 'white'
      }}>
        {loading ? (
          <p>Связь с базой...</p>
        ) : (
          <>
            <h2>{itemName}</h2>
            <p>В облачной базе: <strong>{quantity}</strong></p>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => updateQuantity(-1)} 
                style={{ padding: '10px', background: '#ffcccc', cursor: 'pointer' }}>
                Потратил (-)
              </button>
              
              <button 
                onClick={() => updateQuantity(1)} 
                style={{ padding: '10px', background: '#ccffcc', cursor: 'pointer' }}>
                Купил (+)
              </button>
            </div>
            
            <p style={{fontSize: '10px', color: '#888', marginTop: '20px'}}>
              *Данные сохраняются в PostgreSQL
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default App