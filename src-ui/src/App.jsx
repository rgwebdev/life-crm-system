import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// Импортируем красивые компоненты от Google
import { 
  Container, Typography, TextField, Button, Card, CardContent, 
  IconButton, Box, AppBar, Toolbar, CircularProgress, Chip 
} from '@mui/material'
import { Add, Remove, Delete, Save } from '@mui/icons-material'

function App() {
  const [items, setItems] = useState([]) 
  const [loading, setLoading] = useState(true)
  const [newItemName, setNewItemName] = useState('')

  // --- ЛОГИКА ОСТАЛАСЬ ПРЕЖНЕЙ ---
  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('id', { ascending: true })
    if (!error) setItems(data || [])
    setLoading(false)
  }

  async function updateQuantity(id, currentQty, change) {
    const newQty = currentQty + change
    if (newQty < 0) return
    setItems(items.map(i => i.id === id ? { ...i, current_quantity: newQty } : i))
    await supabase.from('inventory_items').update({ current_quantity: newQty }).eq('id', id)
  }

  async function addNewItem() {
    if (!newItemName.trim()) return
    const { data, error } = await supabase
      .from('inventory_items')
      .insert([{ name: newItemName, current_quantity: 0, min_threshold: 1 }])
      .select()
    if (!error && data) {
      setItems([...items, ...data])
      setNewItemName('')
    }
  }

  async function deleteItem(id) {
    if (!confirm('Точно удалить?')) return
    setItems(items.filter(i => i.id !== id))
    await supabase.from('inventory_items').delete().eq('id', id)
  }
  // -------------------------------

  return (
    // Box - это контейнер с серым фоном на весь экран
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      
      {/* Верхняя синяя панель */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            🥑 Life ERP
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ mt: 4, pb: 4 }}>
        
        {/* Блок добавления */}
        <Card sx={{ p: 2, mb: 3, display: 'flex', gap: 1 }}>
          <TextField 
            fullWidth 
            label="Что купить? (напр. Сыр)" 
            variant="outlined" 
            size="small"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addNewItem()}
          />
          <Button variant="contained" onClick={addNewItem} startIcon={<Save />}>
            ОК
          </Button>
        </Card>

        {loading ? (
          <Box display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Box display="flex" flexDirection="column" gap={2}>
            {items.map(item => {
              // Логика цвета: если мало - красный фон, иначе белый
              const isLow = item.current_quantity < item.min_threshold;
              
              return (
                <Card key={item.id} sx={{ bgcolor: isLow ? '#ffebee' : 'white' }}>
                  <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: '16px !important' }}>
                    
                    {/* Название и количество */}
                    <Box>
                      <Typography variant="h6">{item.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Остаток: <b>{item.current_quantity}</b> {item.unit || 'шт'}
                        {isLow && <Chip label="Мало!" color="error" size="small" sx={{ ml: 1 }} />}
                      </Typography>
                    </Box>

                    {/* Кнопки управления */}
                    <Box display="flex" alignItems="center">
                      <IconButton onClick={() => updateQuantity(item.id, item.current_quantity, -1)} color="primary">
                        <Remove />
                      </IconButton>
                      
                      <IconButton onClick={() => updateQuantity(item.id, item.current_quantity, 1)} color="success">
                        <Add />
                      </IconButton>

                      <IconButton onClick={() => deleteItem(item.id)} color="default" sx={{ ml: 1 }}>
                        <Delete />
                      </IconButton>
                    </Box>

                  </CardContent>
                </Card>
              )
            })}
          </Box>
        )}
      </Container>
    </Box>
  )
}

export default App